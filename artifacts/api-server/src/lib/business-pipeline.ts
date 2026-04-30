import OpenAI from "openai";
import { db } from "@workspace/db";
import { submissionsTable, contributorsTable, businessesTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { downloadMedia, sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";
import { objectStorageClient } from "./objectStorage";
import { isLocalStorage, localSave } from "./localStorage";
import { postBusinessToFacebook } from "./facebook-poster";
import { randomUUID } from "crypto";
import { applyWatermark } from "./watermark";

export interface BusinessPipelinePayload {
  submissionId: number;
  phoneNumber: string;
  contributorId: number;
  combinedText: string;
  mediaUrls: string[];
}

// ---------------------------------------------------------------------------
// Slugify a business name
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await db
      .select({ id: businessesTable.id })
      .from(businessesTable)
      .where(eq(businessesTable.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

// ---------------------------------------------------------------------------
// Deduplication: check for an existing business by slug, phone, or website
// ---------------------------------------------------------------------------

function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-().+]/g, "").replace(/^00353/, "0").replace(/^353/, "0");
}

function normaliseWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

interface DuplicateMatch {
  id: number;
  name: string;
  slug: string;
  status: string;
  matchedOn: "name" | "phone" | "website";
}

async function findDuplicateBusiness(
  slug: string,
  phone: string | null,
  website: string | null,
): Promise<DuplicateMatch | null> {
  // 1. Exact slug (name) match
  const bySlug = await db
    .select({ id: businessesTable.id, name: businessesTable.name, slug: businessesTable.slug, status: businessesTable.status })
    .from(businessesTable)
    .where(eq(businessesTable.slug, slug))
    .limit(1);
  if (bySlug.length > 0) return { ...bySlug[0], matchedOn: "name" };

  // 2. Phone match (normalised)
  const normPhone = normalisePhone(phone);
  if (normPhone) {
    const allWithPhone = await db
      .select({ id: businessesTable.id, name: businessesTable.name, slug: businessesTable.slug, status: businessesTable.status, phone: businessesTable.phone })
      .from(businessesTable);
    const phoneMatch = allWithPhone.find((b) => normalisePhone(b.phone) === normPhone);
    if (phoneMatch) return { id: phoneMatch.id, name: phoneMatch.name, slug: phoneMatch.slug, status: phoneMatch.status, matchedOn: "phone" };
  }

  // 3. Website match (normalised)
  const normSite = normaliseWebsite(website);
  if (normSite) {
    const allWithSite = await db
      .select({ id: businessesTable.id, name: businessesTable.name, slug: businessesTable.slug, status: businessesTable.status, website: businessesTable.website })
      .from(businessesTable);
    const siteMatch = allWithSite.find((b) => normaliseWebsite(b.website) === normSite);
    if (siteMatch) return { id: siteMatch.id, name: siteMatch.name, slug: siteMatch.slug, status: siteMatch.status, matchedOn: "website" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Upload logo to object storage
// ---------------------------------------------------------------------------
async function uploadLogoBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const watermarked = await applyWatermark(buffer);
    const objectId = randomUUID();

    if (isLocalStorage()) {
      const objectPath = `whatsapp-images/${objectId}.jpg`;
      await localSave(objectPath, watermarked);
      return `/api/storage/objects/${objectPath}`;
    }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!bucketId || !privateDir) {
      logger.warn("Object storage not configured — logo will not be saved");
      return null;
    }

    const cleanDir = privateDir.replace(/^\/+/, "");
    const gcsPath = `${cleanDir}/whatsapp-images/${objectId}.jpg`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(gcsPath);
    await file.save(watermarked, { contentType: "image/jpeg", resumable: false });
    return `/api/storage/objects/${gcsPath}`;
  } catch (err) {
    logger.error({ err }, "Business pipeline: failed to upload logo");
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI: Extract structured business data
// ---------------------------------------------------------------------------
interface ExtractedBusiness {
  businessName: string;
  ownerName: string | null;
  category: string;
  subcategory: string | null;
  description: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  area: string | null;
  facebookPostText: string;
  completeness: number;
}

async function extractBusinessData(openai: OpenAI, text: string): Promise<ExtractedBusiness> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an assistant for What's Up Tallaght, a community news platform serving Tallaght, Dublin. 

A local business owner has submitted their business for listing in the WUT community business directory via WhatsApp. 

Extract all structured information and generate a directory listing. Return JSON with these fields:

- businessName: The name of the business (string, required)
- ownerName: The owner/contact name if mentioned (string or null)
- category: Best category from: "Trades & Construction", "Food & Drink", "Health & Wellness", "Beauty & Hair", "Technology & IT", "Retail & Shopping", "Professional Services", "Childcare & Education", "Sport & Fitness", "Community & Charity", "Transport & Logistics", "Other" (string, required)
- subcategory: More specific type e.g. "Web Design", "Plumber", "Café" (string or null)
- description: A friendly 2-3 sentence directory blurb written in third-person. Mention Tallaght. SEO-friendly. (string, required)
- phone: Phone number if provided (string or null)
- email: Email address if provided (string or null)
- website: Website URL if provided, cleaned up to include https:// (string or null)
- address: Street address if provided (string or null)
- area: Tallaght sub-area e.g. "Jobstown", "Tallaght Village", "Kilnamanagh", "Clondalkin", or just "Tallaght" if unknown (string or null)
- facebookPostText: A short punchy Facebook post (max 220 chars) introducing this business to the Tallaght community. Start with a relevant emoji. Warm, community-focused, local tone. Include phone or website if available. Do NOT include a URL at the end (it will be added automatically).
- completeness: 0.0–1.0 score of how complete the information is`,
      },
      { role: "user", content: text },
    ],
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? "{}") as ExtractedBusiness;
  } catch {
    return {
      businessName: "Local Business",
      ownerName: null,
      category: "Other",
      subcategory: null,
      description: "A local Tallaght business.",
      phone: null,
      email: null,
      website: null,
      address: null,
      area: "Tallaght",
      facebookPostText: "🏪 A new local business has joined the WUT directory! Check them out.",
      completeness: 0.3,
    };
  }
}

// ---------------------------------------------------------------------------
// Main business pipeline entry point
// ---------------------------------------------------------------------------
export async function processBusinessListing(
  openai: OpenAI,
  payload: BusinessPipelinePayload,
): Promise<void> {
  const { submissionId, phoneNumber, contributorId, combinedText, mediaUrls } = payload;

  logger.info({ submissionId }, "Business pipeline: starting");

  // --- Mark submission as processing ---
  await db
    .update(submissionsTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- Download logo if image was attached ---
  let logoUrl: string | null = null;
  for (const mediaId of mediaUrls) {
    try {
      const { buffer, mimeType } = await downloadMedia(mediaId);
      if (mimeType.startsWith("image/")) {
        logoUrl = await uploadLogoBuffer(buffer, mimeType);
        logger.info({ submissionId, logoUrl }, "Business pipeline: logo stored");
        break;
      }
    } catch (err) {
      logger.warn({ err, submissionId, mediaId }, "Business pipeline: failed to download media");
    }
  }

  // --- AI extraction ---
  logger.info({ submissionId }, "Business pipeline: extracting business data");
  const extracted = await extractBusinessData(openai, combinedText);
  logger.info({ submissionId, businessName: extracted.businessName, category: extracted.category }, "Business pipeline: extraction complete");

  // --- Build slug ---
  const baseSlug = slugify(extracted.businessName);
  // Note: we check against baseSlug (not ensureUniqueSlug yet) so we catch the existing record
  const slug = baseSlug || `business-${submissionId}`;

  // --- Deduplication check ---
  const duplicate = await findDuplicateBusiness(slug, extracted.phone, extracted.website);
  if (duplicate) {
    logger.info({ submissionId, duplicateId: duplicate.id, matchedOn: duplicate.matchedOn }, "Business pipeline: duplicate detected — skipping insert");

    const platformUrl = "https://whatsuptallaght.ie";
    const isPending = duplicate.status === "pending_review";
    const isRejected = duplicate.status === "rejected";

    let message: string;
    if (isRejected) {
      message = `Hi! It looks like "${duplicate.name}" was already submitted to the WUT directory but wasn't approved. If you'd like to re-apply or have any questions, please reply here and we'll sort it out 👍`;
    } else if (isPending) {
      message = `Hi! "${duplicate.name}" has already been submitted to the WUT directory and is currently under review. We'll let you know as soon as it's live 👍`;
    } else {
      const listingUrl = `${platformUrl}/directory/${duplicate.slug}`;
      message = `Hi! "${duplicate.name}" is already listed in the WUT Business Directory 🎉\n\nYou can see the listing here:\n${listingUrl}\n\nIf you'd like to update any details, just reply here and we'll help you out 👍`;
    }

    await sendTextMessage(phoneNumber, message).catch(() => {});
    await db.update(submissionsTable).set({ status: "processed", updatedAt: new Date() }).where(eq(submissionsTable.id, submissionId));
    return;
  }

  // --- Ensure unique slug (only needed if not a duplicate) ---
  const uniqueSlug = await ensureUniqueSlug(slug);

  // --- Set expiry (1 year from now) ---
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  // --- Insert business record (pending_review) ---
  const [business] = await db
    .insert(businessesTable)
    .values({
      slug: uniqueSlug,
      name: extracted.businessName,
      ownerName: extracted.ownerName,
      category: extracted.category,
      subcategory: extracted.subcategory,
      description: extracted.description,
      phone: extracted.phone,
      email: extracted.email,
      website: extracted.website,
      address: extracted.address,
      area: extracted.area,
      logoUrl,
      facebookPostText: extracted.facebookPostText,
      status: "pending_review",
      sourceSubmissionId: submissionId,
      contributorId,
      expiresAt,
    })
    .returning();

  logger.info({ submissionId, businessId: business.id, slug: uniqueSlug }, "Business pipeline: record created (pending_review)");

  // --- Mark submission as processed ---
  await db
    .update(submissionsTable)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- WhatsApp reply to submitter ---
  await sendTextMessage(
    phoneNumber,
    `Thanks for submitting your business to What's Up Tallaght! 🎉\n\nWe'll review "${extracted.businessName}" and it'll be live on the WUT directory shortly. We'll message you when it's up 👍`,
  ).catch(() => {});

  logger.info({ submissionId, businessId: business.id }, "Business pipeline: complete");
}

// ---------------------------------------------------------------------------
// Approve a business listing: post to Facebook + WhatsApp notification
// ---------------------------------------------------------------------------
export async function approveBusiness(
  businessId: number,
  platformUrl: string,
): Promise<{ success: boolean; facebookPostId?: string | null; error?: string }> {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId))
    .limit(1);

  if (!business) {
    return { success: false, error: "Business not found" };
  }

  // --- Post to Facebook ---
  let facebookPostId: string | null = null;
  if (business.facebookPostText) {
    const fbResult = await postBusinessToFacebook({
      name: business.name,
      slug: business.slug,
      facebookPostText: business.facebookPostText,
      logoUrl: business.logoUrl,
    });
    if (fbResult.postId) {
      facebookPostId = fbResult.postId;
      logger.info({ businessId, facebookPostId }, "Business: posted to Facebook on approval");
    } else {
      logger.warn({ businessId, error: fbResult.errorDetail }, "Business: Facebook post failed on approval (non-fatal)");
    }
  }

  // --- Activate the listing ---
  await db
    .update(businessesTable)
    .set({
      status: "active",
      facebookPostId,
      updatedAt: new Date(),
    })
    .where(eq(businessesTable.id, businessId));

  // --- WhatsApp notification to contributor ---
  if (business.contributorId) {
    const [contributor] = await db
      .select({ phoneHash: contributorsTable.phoneHash })
      .from(contributorsTable)
      .where(eq(contributorsTable.id, business.contributorId))
      .limit(1);

    if (contributor?.phoneHash) {
      const base = (platformUrl ?? "https://whatsuptallaght.ie").replace(/\/$/, "");
      const listingUrl = `${base}/directory/${business.slug}`;
      await sendTextMessage(
        contributor.phoneHash,
        `Great news! 🎉 Your business "${business.name}" is now live on the WUT directory:\n\n${listingUrl}\n\nWe've also posted an intro on our Facebook page!`,
      ).catch(() => {});
    }
  }

  return { success: true, facebookPostId };
}
