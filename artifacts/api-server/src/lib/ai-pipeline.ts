import OpenAI, { toFile } from "openai";
import { applyWatermark } from "./watermark";
import { postToFacebookPage } from "./facebook-poster";
import { generateAndStoreSocialCaptions, getSocialCaptionsForPost } from "./social-caption-agent";
import { matchEntityInArticle } from "./entity-matcher";
import { db } from "@workspace/db";
import {
  submissionsTable,
  postsTable,
  categoriesTable,
  goldenExamplesTable,
  rssItemsTable,
  aiUsageLogTable,
  eventsTable,
  headerImageAssetsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSettingValue } from "../routes/settings";
import { downloadMedia } from "./whatsapp-client";
import { sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";
import { objectStorageClient } from "./objectStorage";
import { isLocalStorage, localSave } from "./localStorage";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Server-side image upload to GCS
// ---------------------------------------------------------------------------

async function uploadImageBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    // Apply the What's Up Tallaght watermark before storing
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
      logger.warn("Object storage not configured — image will not be saved");
      return null;
    }

    const cleanDir = privateDir.replace(/^\/+/, "");
    const gcsPath = `${cleanDir}/whatsapp-images/${objectId}.jpg`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(gcsPath);
    await file.save(watermarked, { contentType: "image/jpeg", resumable: false });
    return `/api/storage/objects/${gcsPath}`;
  } catch (err) {
    logger.error({ err }, "Failed to upload image to object storage");
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

async function getOpenAI(): Promise<OpenAI> {
  const apiKey = (await getSettingValue("openai_api_key")) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured");
  return new OpenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
};

function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 2.50, output: 10.00 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

type UsageCtx = { submissionId: number; jobId?: number };

function logUsage(
  ctx: UsageCtx,
  model: string,
  stage: string,
  usage: { prompt_tokens: number; completion_tokens: number } | undefined,
): void {
  if (!usage) return;
  const inputTokens = usage.prompt_tokens;
  const outputTokens = usage.completion_tokens;
  const costUsd = calcCostUsd(model, inputTokens, outputTokens);

  db.insert(aiUsageLogTable)
    .values({
      submissionId: ctx.submissionId,
      jobId: ctx.jobId,
      model,
      stage,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd.toFixed(6),
    })
    .execute()
    .catch((err) => logger.warn({ err }, "Failed to log AI usage"));
}

// ---------------------------------------------------------------------------
// Stage 1 — Safety check (OpenAI Moderation, free)
// ---------------------------------------------------------------------------

async function runSafetyCheck(
  openai: OpenAI,
  text: string,
): Promise<{ passed: boolean; reason?: string }> {
  if (!text.trim()) return { passed: true };

  const result = await openai.moderations.create({ input: text });
  const flagged = result.results[0].flagged;
  const categories = result.results[0].categories as Record<string, boolean>;
  const flaggedCategories = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return {
    passed: !flagged,
    reason: flagged ? `Flagged: ${flaggedCategories.join(", ")}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — Audio transcription (Whisper)
// ---------------------------------------------------------------------------

async function transcribeAudio(
  openai: OpenAI,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("mpeg")
        ? "mp3"
        : mimeType.includes("aac")
          ? "aac"
          : "ogg";

  const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
  });
  return result.text;
}

// ---------------------------------------------------------------------------
// Stage 3 — Image understanding (GPT-4o Vision)
// ---------------------------------------------------------------------------

async function describeImage(openai: OpenAI, buffer: Buffer, mimeType: string, ctx: UsageCtx): Promise<string> {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
          {
            type: "text",
            text: `Extract all factual information visible in this image for a local community news article.

CRITICAL RULES:
- Copy dates, times, prices, names, and locations EXACTLY as they appear in the image. Do not paraphrase, correct, or infer them.
- If a date shows "Apr 18" write "April 18". If a time shows "5 pm", write "5 pm". Do not change these.
- Only report what is explicitly visible. Do not add context, background, or interpretation.
- If text is unclear or partially visible, say so rather than guessing.

Report: event name, date, time, venue, organiser, ticket price, and a brief description of what the event is, using only what is written in the image.`,
          },
        ],
      },
    ],
  });

  logUsage(ctx, "gpt-4o", "image_describe", response.usage ?? undefined);
  return response.choices[0].message.content ?? "";
}

// ---------------------------------------------------------------------------
// Stage 4 — Tone classification (GPT-4o-mini, JSON)
// ---------------------------------------------------------------------------

interface ToneResult {
  tone: "news" | "event" | "sport" | "community" | "business" | "warning" | "memorial" | "other";
  suggestedCategory: string;
  confidence: number;
}

async function classifyTone(
  openai: OpenAI,
  combinedText: string,
  ctx: UsageCtx,
  categories: { name: string; description: string | null }[],
): Promise<ToneResult> {
  const categoryList = categories
    .map((c) => `- "${c.name}"${c.description ? ` — ${c.description}` : ""}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an editor for a Tallaght, Dublin community news platform. Classify the tone of the following submission and suggest the best category from the list below.

Categories available:
${categoryList}

Respond in JSON: { "tone": string, "suggestedCategory": string, "confidence": number (0–1) }
The suggestedCategory must exactly match one of the category names listed above.`,
      },
      { role: "user", content: combinedText },
    ],
  });

  logUsage(ctx, "gpt-4o-mini", "tone_classify", response.usage ?? undefined);
  try {
    return JSON.parse(response.choices[0].message.content ?? "{}") as ToneResult;
  } catch {
    return { tone: "news", suggestedCategory: categories[0]?.name ?? "News & Issues", confidence: 0.5 };
  }
}

// ---------------------------------------------------------------------------
// Stage 5 — Information extraction (GPT-4o-mini, JSON)
// ---------------------------------------------------------------------------

interface ExtractedInfo {
  headline: string;
  location: string | null;
  eventDate: string | null;
  keyFacts: string[];
  sentiment: "positive" | "negative" | "neutral";
  wordCount: number;
  completenessScore: number;
  // Explicit completeness criteria — scored in code, not by AI guess
  hasLocation: boolean;
  hasDateTime: boolean;
  hasClearSubject: boolean;
  hasActionableInfo: boolean;
}

/**
 * Compute completeness score from four explicit criteria (0.25 each).
 * Each criterion is a boolean flag returned by the AI — scored here in code
 * so the result is deterministic and auditable, not a single AI-guessed number.
 */
function computeCompletenessScore(flags: {
  hasLocation: boolean;
  hasDateTime: boolean;
  hasClearSubject: boolean;
  hasActionableInfo: boolean;
}): number {
  return (
    (flags.hasLocation ? 0.25 : 0) +
    (flags.hasDateTime ? 0.25 : 0) +
    (flags.hasClearSubject ? 0.25 : 0) +
    (flags.hasActionableInfo ? 0.25 : 0)
  );
}

async function extractInfo(openai: OpenAI, combinedText: string, ctx: UsageCtx): Promise<ExtractedInfo> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an editor for a Tallaght, Dublin community news platform. Extract key information from this submission.

Respond in JSON:
{
  "headline": "Suggested article headline (max 12 words, factual, no clickbait)",
  "location": "Specific area in Tallaght/Dublin or null",
  "eventDate": "ISO date string if an event date is mentioned, or null",
  "keyFacts": ["Array of up to 5 key facts from the submission"],
  "sentiment": "positive | negative | neutral",
  "wordCount": number,
  "hasLocation": boolean (true if the submission mentions a specific place, venue, or area),
  "hasDateTime": boolean (true if a date or time is mentioned, even approximately),
  "hasClearSubject": boolean (true if it is clear who or what the story is about),
  "hasActionableInfo": boolean (true if the submission contains something useful to the reader — an event to attend, a warning to act on, a result, a notice, etc.)
}`,
      },
      { role: "user", content: combinedText },
    ],
  });

  logUsage(ctx, "gpt-4o-mini", "info_extract", response.usage ?? undefined);
  try {
    const raw = JSON.parse(response.choices[0].message.content ?? "{}");
    const flags = {
      hasLocation:      Boolean(raw.hasLocation),
      hasDateTime:      Boolean(raw.hasDateTime),
      hasClearSubject:  Boolean(raw.hasClearSubject),
      hasActionableInfo: Boolean(raw.hasActionableInfo),
    };
    return {
      ...raw,
      ...flags,
      completenessScore: computeCompletenessScore(flags),
    } as ExtractedInfo;
  } catch {
    return {
      headline: "Community Update",
      location: null,
      eventDate: null,
      keyFacts: [],
      sentiment: "neutral",
      wordCount: combinedText.split(" ").length,
      hasLocation: false,
      hasDateTime: false,
      hasClearSubject: false,
      hasActionableInfo: false,
      completenessScore: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Stage 5b — Event detail extraction (GPT-4o-mini, JSON) — runs when tone === "event"
// ---------------------------------------------------------------------------

interface EventDetails {
  eventDate: string | null;        // ISO date YYYY-MM-DD
  eventTime: string | null;        // Human-readable e.g. "7:30 PM"
  endDate: string | null;          // ISO date YYYY-MM-DD or null
  endTime: string | null;          // Human-readable e.g. "10:00 PM" or null
  location: string | null;         // Venue / address
  organiser: string | null;        // Organisation or person running the event
  price: string | null;            // "Free", "€5", "Donation welcome", etc.
  contactInfo: string | null;      // Phone, email, or social media
  websiteUrl: string | null;       // URL for more info
  shortDescription: string | null; // 1-2 sentence summary of the event
}

async function extractEventDetails(openai: OpenAI, combinedText: string, ctx: UsageCtx): Promise<EventDetails | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an events editor for a community news platform in Tallaght, Dublin.
Extract structured event details from the following submission. Today's date is ${today}.

CRITICAL RULES:
- Extract dates and times EXACTLY as they appear. Do not guess or infer if not mentioned.
- For relative dates like "this Saturday" or "next Friday", calculate the actual ISO date (YYYY-MM-DD) based on today being ${today}.
- If the event date cannot be determined, return null for eventDate.
- Return null for any field that is genuinely not mentioned or cannot be determined.

Respond in JSON:
{
  "eventDate": "YYYY-MM-DD or null",
  "eventTime": "Human-readable start time or null",
  "endDate": "YYYY-MM-DD or null",
  "endTime": "Human-readable end time or null",
  "location": "Venue name and/or address or null",
  "organiser": "Organisation or person organising the event or null",
  "price": "Free | €X | Ticket price description or null",
  "contactInfo": "Phone number, email, or social media handle or null",
  "websiteUrl": "Full URL for tickets or more info or null",
  "shortDescription": "1-2 sentence factual description of the event or null"
}`,
        },
        { role: "user", content: combinedText },
      ],
    });

    logUsage(ctx, "gpt-4o-mini", "event_extract", response.usage ?? undefined);
    return JSON.parse(response.choices[0].message.content ?? "{}") as EventDetails;
  } catch (err) {
    logger.warn({ err }, "AI pipeline: event extraction failed (non-fatal)");
    return null;
  }
}

/**
 * Exported: re-run event extraction on an existing post and insert an event
 * record if one doesn't already exist. Used by the admin "Extract Event"
 * button when the pipeline originally missed the event (wrong tone, no date, etc.)
 */
export async function extractAndSaveEventForPost(postId: number): Promise<{ created: boolean; eventDate?: string; reason?: string }> {
  const [post] = await db.select({ id: postsTable.id, title: postsTable.title, body: postsTable.body }).from(postsTable).where(eq(postsTable.id, postId));
  if (!post) return { created: false, reason: "Post not found" };

  // Check if an event already exists for this post
  const existing = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.articleId, postId));
  if (existing.length > 0) return { created: false, reason: "Event already exists for this article" };

  const apiKey = (await getSettingValue("openai_api_key")) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { created: false, reason: "OpenAI API key is not configured" };
  const openai = new OpenAI({ apiKey });
  const ctx: UsageCtx = { jobId: 0, submissionId: postId };
  const details = await extractEventDetails(openai, post.body, ctx);
  if (!details) return { created: false, reason: "AI could not extract event details" };

  const eventDate = details.eventDate;
  if (!eventDate) return { created: false, reason: "No event date found in article — add the date to the article first, then try again" };

  const today = new Date().toISOString().split("T")[0];
  const status = eventDate < today ? "past" : "upcoming";

  await db.insert(eventsTable).values({
    articleId: postId,
    title: post.title,
    eventDate,
    eventTime: details.eventTime ?? null,
    endDate: details.endDate ?? null,
    endTime: details.endTime ?? null,
    location: details.location ?? null,
    description: details.shortDescription ?? null,
    organiser: details.organiser ?? null,
    contactInfo: details.contactInfo ?? null,
    websiteUrl: details.websiteUrl ?? null,
    price: details.price ?? null,
    status,
  });

  return { created: true, eventDate };
}

async function maybeCreateEventRecord(
  postId: number,
  postTitle: string,
  tone: string,
  combinedText: string,
  openai: OpenAI,
  ctx: UsageCtx,
  infoEventDate: string | null,
  hasDateTime = false,
): Promise<void> {
  // Run if classified as event, OR if any other tone but the submission contains a date/time.
  // This catches "community" articles that are actually about events (e.g. "Community Fair this Saturday").
  const isEventTone = tone === "event";
  const mightBeEvent = hasDateTime && infoEventDate !== null;
  if (!isEventTone && !mightBeEvent) return;

  const details = await extractEventDetails(openai, combinedText, ctx);
  if (!details) return;

  const eventDate = details.eventDate ?? infoEventDate;
  if (!eventDate) {
    logger.info({ postId, tone }, "AI pipeline: submission has a date but no event date could be extracted — skipping event record");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const status = eventDate < today ? "past" : "upcoming";

  await db.insert(eventsTable).values({
    articleId: postId,
    title: postTitle,
    eventDate,
    eventTime: details.eventTime ?? null,
    endDate: details.endDate ?? null,
    endTime: details.endTime ?? null,
    location: details.location ?? null,
    description: details.shortDescription ?? null,
    organiser: details.organiser ?? null,
    contactInfo: details.contactInfo ?? null,
    websiteUrl: details.websiteUrl ?? null,
    price: details.price ?? null,
    status,
  });

  logger.info({ postId, eventDate, status }, "AI pipeline: event record created");
}

// ---------------------------------------------------------------------------
// Stage 6b — Header image generation (DALL·E 3, optional)
// ---------------------------------------------------------------------------

// Generic words that are useless for image topic matching
const IMAGE_STOP_WORDS = new Set([
  "community","local","tallaght","dublin","ireland","member","members",
  "resident","residents","area","news","update","updates","latest","new",
  "this","that","from","with","for","and","the","has","have","been",
  "their","which","about","after","amid","also","says","shares","shared",
  "sharing","first","last","week","month","year","day","today","tonight",
  "people","person","told","said","report","reported","annual","other",
  "more","some","many","most","very","well","good","great","best","next",
  "over","into","onto","upon","will","would","could","should","does","made",
  "make","take","gets","gets","gives","came","come","goes","gone","went",
]);

/**
 * Extract specific topic keywords from a headline for image asset matching.
 * Filters out generic stop words so only meaningful subject words remain.
 */
function extractTopicKeywords(headline: string): string[] {
  return headline
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length >= 4 && !IMAGE_STOP_WORDS.has(w))
    .slice(0, 8);
}

function buildDallePrompt(headline: string, keyFacts: string[], tone: string, entityContext?: string | null): string {
  const facts = keyFacts.slice(0, 3).filter(Boolean).join(", ");

  // Photorealistic camera/lighting specs per tone.
  // Deliberately avoid scene types that produce signs/banners (stadium hoardings, scoreboards,
  // protest placards) — DALL-E renders text on these as garbled nonsense.
  const styleByTone: Record<string, string> = {
    news:      "photorealistic editorial press photograph, 35mm lens, f/4 aperture, overcast natural daylight, documentary style, candid moment — focus on people and environment, no constructed signage in frame",
    event:     "photorealistic event photograph, wide-angle lens, vibrant natural light, authentic crowd atmosphere, professional press photography — capture faces and movement, no banners or signs in foreground",
    sport:     "photorealistic sports action photograph, telephoto lens, fast shutter speed, shallow depth of field, players on open grass pitch, dynamic composition — tight crop on athletic action, no hoardings or advertising boards visible",
    community: "photorealistic community documentary photograph, 50mm lens, warm natural light, genuine authentic moment, neighbourhood setting — architecture and people, no close-up signage",
    business:  "photorealistic commercial photograph, professional natural lighting, 35mm lens, clean composition, local business environment — exterior or interior without visible signage or text on surfaces",
    warning:   "photorealistic documentary photograph, overcast sky, desaturated colour grading, journalistic style, reportage photography — environmental wide shot, no text-bearing objects in focus",
    memorial:  "photorealistic respectful photograph, soft diffused natural light, 50mm lens, quiet dignified scene, muted tones — flowers, candles, gathering people, no written text elements",
    other:     "photorealistic news photograph, 50mm lens, natural lighting, editorial documentary style — clean scene without signs or text",
  };
  const style = styleByTone[tone] ?? styleByTone.other;
  const factsClause = facts ? ` Scene context: ${facts}.` : "";
  const entityClause = entityContext ? ` Visual detail: ${entityContext}` : "";

  // The no-text rule is stated three different ways and placed FIRST so DALL-E weights it heavily.
  const noText = "CRITICAL RULES — strictly no text, writing, letters, words, numbers, legible signs, banners, placards, scoreboards, advertising hoardings, or logos anywhere in the image. If any text would naturally appear (shirt numbers excepted), replace it with abstract pattern or blur it out of focus.";

  return `${noText} ${style}. Subject: ${headline}.${factsClause}${entityClause} Setting: Tallaght or Dublin, Ireland. No watermarks. No identifiable real faces. Shot on professional camera, high resolution, sharp focus, cinematic depth.`;
}

/**
 * Looks up visual context for real-world entities mentioned in the headline/facts
 * using GPT's knowledge — team colours, venue details, brand identity etc.
 * Returns a short descriptive string to enrich the DALL-E prompt, or null if nothing useful found.
 */
async function researchEntityContext(
  openai: OpenAI,
  headline: string,
  keyFacts: string[],
): Promise<string | null> {
  try {
    const text = `${headline}. ${keyFacts.slice(0, 4).join(". ")}`;
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a visual research assistant for a news image generator powered by DALL-E 3.

Given a headline and facts, identify any specific real-world entities (sports clubs, organisations, venues, events, Irish landmarks).
For each recognised entity, provide brief VISUAL details to help generate an accurate photorealistic image:
- Sports clubs: kit colours and style only (e.g. "hooped green and white jerseys, dark shorts")
- Venues: surface type, rough size/feel, architecture style — NO named stands or signage
- Organisations: brand colour palette, typical physical setting without branded signage

CRITICAL CONSTRAINTS for DALL-E compatibility:
- Never suggest scenes that would contain text, signs, banners, hoardings, scoreboards, or logos
- Focus on colours, materials, textures, and body language — not readable identifiers
- Describe WHAT things look like, not what they say
- Only include details you are CONFIDENT are accurate. Do not invent or guess.
- Return 1–2 sentences of visual detail only. No explanations.
- If no specific real-world entities are identifiable, return an empty string.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const result = response.choices[0].message.content?.trim() ?? "";
    return result.length > 10 ? result : null;
  } catch {
    return null;
  }
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateHeaderImage(
  openai: OpenAI,
  headline: string,
  keyFacts: string[],
  tone: string,
  ctx: UsageCtx,
): Promise<{ imageUrl: string; imagePrompt: string } | null> {
  try {
    // Research real-world entity context (team colours, venue details etc.) to enrich the prompt
    const entityContext = await researchEntityContext(openai, headline, keyFacts);
    if (entityContext) {
      logger.info({ submissionId: ctx.submissionId, entityContext }, "AI pipeline: entity context found for image");
    }

    const prompt = buildDallePrompt(headline, keyFacts, tone, entityContext);
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      response_format: "url",
    });

    const tempUrl = response.data?.[0]?.url;
    if (!tempUrl) return null;

    const buffer = await downloadBuffer(tempUrl);
    const storedPath = await uploadImageBuffer(buffer, "image/jpeg");
    if (!storedPath) return null;

    db.insert(aiUsageLogTable)
      .values({
        submissionId: ctx.submissionId,
        jobId: ctx.jobId,
        model: "dall-e-3",
        stage: "generate_image",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: "0.040000",
      })
      .execute()
      .catch((err) => logger.warn({ err }, "Failed to log DALL·E usage"));

    logger.info({ submissionId: ctx.submissionId }, "AI pipeline: header image generated");
    return { imageUrl: storedPath, imagePrompt: prompt };
  } catch (err) {
    logger.error({ err, submissionId: ctx.submissionId }, "AI pipeline: DALL·E generation failed (non-fatal)");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Asset library — find a reusable header image or generate + store a new one
// ---------------------------------------------------------------------------

const MAX_ASSET_REUSE = 50; // max articles that can share the same header image (cost saving)

async function findOrCreateHeaderAsset(
  openai: OpenAI,
  headline: string,
  keyFacts: string[],
  tone: string,
  ctx: UsageCtx,
): Promise<{ imageUrl: string; imagePrompt: string } | null> {
  // Extract specific topic keywords from the headline (e.g. "fishing", "erne", "angling")
  // NOT from keyFacts sentences which contain generic words like "community" that cause false matches
  const topicKeywords = extractTopicKeywords(headline);

  // Search existing assets with matching tone
  const candidates = await db
    .select()
    .from(headerImageAssetsTable)
    .where(eq(headerImageAssetsTable.tone, tone));

  // Only reuse if there are specific topic keywords AND at least 2 of them overlap with the asset's keywords.
  // This prevents a "fishing" article from reusing a "shopping street" image just because both
  // have the generic word "community" in their keyFacts.
  const match = candidates.find((asset) => {
    if (asset.usageCount >= MAX_ASSET_REUSE) return false;
    if (topicKeywords.length === 0) return false; // no specific topic — always generate fresh
    const assetKws = (asset.keywords ?? []).map((k: string) => k.toLowerCase());
    const overlapCount = topicKeywords.filter((k) =>
      assetKws.some((ak) => ak === k || ak.includes(k) || k.includes(ak)),
    ).length;
    return overlapCount >= 2; // require at least 2 specific matching words
  });

  if (match) {
    await db
      .update(headerImageAssetsTable)
      .set({ usageCount: match.usageCount + 1 })
      .where(eq(headerImageAssetsTable.id, match.id));
    logger.info({ submissionId: ctx.submissionId, assetId: match.id, topicKeywords }, "AI pipeline: reusing header image from library");
    return { imageUrl: match.imageUrl, imagePrompt: match.prompt };
  }

  // No reusable asset — generate a new one and save to library
  const generated = await generateHeaderImage(openai, headline, keyFacts, tone, ctx);
  if (!generated) return null;

  // Store specific topic keywords (not full keyFacts sentences) so future matching is precise
  await db
    .insert(headerImageAssetsTable)
    .values({
      imageUrl: generated.imageUrl,
      tone,
      keywords: topicKeywords.length > 0 ? topicKeywords : keyFacts.slice(0, 6),
      prompt: generated.imagePrompt,
      usageCount: 1,
    })
    .catch((err) => logger.warn({ err }, "AI pipeline: failed to save header image to library (non-fatal)"));

  return generated;
}

// ---------------------------------------------------------------------------
// Stage 6 — Article writing (GPT-4o)
// ---------------------------------------------------------------------------

async function writeArticle(
  openai: OpenAI,
  combinedText: string,
  info: ExtractedInfo,
  tone: ToneResult,
  goldenExamples: { inputText: string; outputText: string }[],
  ctx: UsageCtx,
  minimalMode = false,
): Promise<string> {
  const examplesBlock =
    goldenExamples.length > 0
      ? goldenExamples
          .map(
            (ex, i) =>
              `Example ${i + 1}:\nOriginal: ${ex.inputText}\nPublished: ${ex.outputText}`,
          )
          .join("\n\n")
      : "";

  const toneGuide: Record<string, string> = {
    community: "Tone: neutral and helpful. Informative without being dramatic. Friendly but factual.",
    event:     "Tone: informative. Clearly communicate what's happening, when, where, and who it's for. No hype.",
    sport:     "Tone: controlled energy. Enthusiastic but grounded — reflect the result or activity without over-celebrating or over-dramatising.",
    warning:   "Tone: clear and urgent. Lead with the essential information. Short sentences. No softening language.",
    memorial:  "Tone: respectful and minimal. Dignified, simple, no filler. Let the facts speak — avoid flowery or emotional language.",
    news:      "Tone: neutral and factual. Report what happened. No editorial opinion.",
    business:  "Tone: professional but accessible. Factual, concise, community-focused.",
    other:     "Tone: neutral, clear, and factual.",
  };
  const toneInstruction = toneGuide[tone.tone] ?? toneGuide.other;

  const systemPrompt = [
    "You are an editor for Tallaght Community, a local news platform for Tallaght, Dublin, Ireland.",
    "Your job is to rewrite community submissions into clean, readable news articles.",
    "",
    "VOICE: Tallaght Community writes like a local person sharing real updates — clear, simple, and grounded. It should feel like something you'd read on Facebook or hear from a neighbour.",
    "",
    `TONE FOR THIS ARTICLE: ${toneInstruction}`,
    "",
    "STRICT RULES — follow these exactly:",
    "",
    "1. ONLY use facts that are explicitly stated in the submission. Never add, infer, assume, or embellish.",
    "   - If the submission says someone caught a fish at an event, do not add detail about what the event means, its philosophy, or its impact.",
    "   - Do not write about what organisations 'are known for' or 'are committed to' unless the submission says so.",
    "   - Do not add quotes, opinions, or motivational language that wasn't in the submission.",
    "   - You may use simple connecting language to make the article read naturally, but do not introduce new facts.",
    "   - If any detail in the submission is uncertain (e.g. 'I think', 'not sure'), reflect that uncertainty in the article. Do not present it as a confirmed fact.",
    "",
    "1b. NAMED PERSONS — reproduce exactly as given. This is a legal requirement.",
    "   - If the submission says 'John from Tallaght', write exactly 'John from Tallaght'. Do NOT add a surname, role, title, or any other detail.",
    "   - Do NOT guess, infer, or expand any name. 'Mary' stays 'Mary'. 'Dave from Jobstown' stays 'Dave from Jobstown'.",
    "   - Never write 'John Smith', 'local resident John', 'coach John', or any variation not in the submission.",
    "   - If the full name is given in the submission, use the full name. If only a first name is given, use only the first name.",
    "",
    "2. LENGTH — write to the natural length of the content, guided by the submission type:",
    "   - Notice (community, warning, memorial): 80–120 words. Keep it tight.",
    "   - Event: 120–200 words. Cover what, where, when, and who.",
    "   - News, sport, business: 150–300 words. Only go longer if the submission genuinely has that much content.",
    "   - If the submission is short, write a short article. Never pad to hit a minimum.",
    "   - Never exceed the upper limit for the type. Do not add background context to fill space.",
    "",
    ...(minimalMode
      ? [
          "⚠️ MINIMAL MODE — this submission is thin. Apply these stricter rules:",
          "   - Write a SHORT NOTICE only: 1–3 sentences maximum. No paragraphs, no structure.",
          "   - State only what is explicitly in the submission. Nothing else.",
          "   - Do not attempt to pad, explain, or add context.",
          "   - Do not write a full news article. A notice is enough.",
          "   - If you cannot write 1 honest sentence from the submission, write nothing.",
          "",
        ]
      : []),
    "3. Write in third person, plain language. No clickbait, no superlatives.",
    "   - Do not add emotional interpretation or commentary unless it is explicitly stated in the submission.",
    "   - Avoid phrases like 'distressing situation', 'highlighted', 'ensuring', or similar formal wording.",
    "   - Keep language simple and grounded.",
    "4. Credit the source as 'a local resident', 'a community member', or by name if given.",
    "   - Do not introduce unnamed sources such as 'a community member said' unless it is explicitly included in the submission.",
    "5. Output the article body only — no headline, no byline, no category label.",
    "",
    "SOURCE PRIORITY:",
    "- If the submission contains a [COMMUNITY MEMBER'S MESSAGE], that text is the story. The photo provides visual context only — do not let it override the text.",
    "- If there is no text (only an [ATTACHED PHOTO]), write from the image description.",
    ...(examplesBlock
      ? [
          "",
          "STYLE REFERENCE:",
          "You will be given example articles written in the preferred style.",
          "Match their tone, structure, and level of simplicity.",
          "Write in a similar way, but do NOT copy phrases or sentences directly.",
          "",
          examplesBlock,
        ]
      : []),
  ].join("\n");

  const userPrompt = [
    `Submission type: ${tone.tone}`,
    `Suggested headline: ${info.headline}`,
    `Location: ${info.location ?? "Tallaght, Dublin"}`,
    info.eventDate ? `Event date: ${info.eventDate}` : "",
    `Key facts: ${info.keyFacts.join("; ")}`,
    "",
    "Raw submission:",
    combinedText,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  logUsage(ctx, "gpt-4o", "write_article", response.usage ?? undefined);
  return response.choices[0].message.content?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Stage 7b — Fact-check (GPT-4o-mini)
// Compares the written article against the original submission.
// Returns PASS or FAIL with specific issues. A FAIL forces the article to
// "held" for editor review — it is never auto-published.
// ---------------------------------------------------------------------------

interface FactCheckResult {
  result: "PASS" | "FAIL";
  issues: string[];
}

async function factCheckArticle(
  openai: OpenAI,
  submission: string,
  article: string,
  ctx: UsageCtx,
): Promise<FactCheckResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a fact-checker for a community news platform.

Your job is to compare a written article against the original submission it was based on.

Look for ANY detail in the article that is NOT explicitly present in the submission:
- Invented names, places, organisations, or events
- Numbers or statistics not in the submission
- Quotes that were not in the submission
- Claimed motivations, opinions, or emotions not stated
- Added context about what an organisation "is known for" or "typically does"
- Any specific detail the submission does not directly support

Respond in JSON:
{
  "result": "PASS" or "FAIL",
  "issues": ["List each fabricated or unsupported detail found. Empty array if PASS."]
}

Return PASS only if every factual claim in the article is directly supported by the submission.
Connecting phrases and rewordings of stated facts are acceptable — only flag genuinely new information.`,
        },
        {
          role: "user",
          content: `ORIGINAL SUBMISSION:\n${submission}\n\n---\n\nWRITTEN ARTICLE:\n${article}`,
        },
      ],
    });

    logUsage(ctx, "gpt-4o-mini", "fact_check", response.usage ?? undefined);
    const raw = JSON.parse(response.choices[0].message.content ?? "{}");
    return {
      result: raw.result === "PASS" ? "PASS" : "FAIL",
      issues: Array.isArray(raw.issues) ? raw.issues : [],
    };
  } catch (err) {
    logger.warn({ err, submissionId: ctx.submissionId }, "AI pipeline: fact-check failed (non-fatal) — defaulting to PASS");
    return { result: "PASS", issues: [] };
  }
}

// ---------------------------------------------------------------------------
// Main pipeline entry point
// ---------------------------------------------------------------------------

export interface PipelinePayload {
  submissionId: number;
  phoneNumber: string;
  contributorId: number;
}

export async function processWhatsAppSubmission(payload: PipelinePayload & { jobId?: number }): Promise<void> {
  const { submissionId, phoneNumber, contributorId, jobId } = payload;
  const ctx: UsageCtx = { submissionId, jobId };

  logger.info({ submissionId }, "AI pipeline: starting");

  // --- Load submission ---
  const [submission] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.id, submissionId))
    .limit(1);

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`);
  }

  // --- Mark as processing ---
  await db
    .update(submissionsTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  const openai = await getOpenAI();

  // --- Stage 1: Safety check ---
  const rawText = submission.rawText ?? "";
  const safety = await runSafetyCheck(openai, rawText);

  if (!safety.passed) {
    logger.warn({ submissionId, reason: safety.reason }, "AI pipeline: safety check failed");
    await db
      .update(submissionsTable)
      .set({
        status: "rejected",
        safetyCheckPassed: "false",
        rejectionReason: safety.reason,
        updatedAt: new Date(),
      })
      .where(eq(submissionsTable.id, submissionId));

    await sendTextMessage(
      phoneNumber,
      "We were unable to process your submission as it didn't meet our community guidelines. If you believe this is an error, please contact us.",
    ).catch(() => {});

    return;
  }

  await db
    .update(submissionsTable)
    .set({ safetyCheckPassed: "true", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- Stage 2 & 3: Media processing ---
  const mediaUrls = submission.mediaUrls ?? [];
  const transcripts: string[] = [];
  const imageDescriptions: string[] = [];
  // All submitted images go into the article body — header is always DALL·E generated
  const bodyImagePaths: string[] = [];

  for (const mediaId of mediaUrls) {
    try {
      const { buffer, mimeType } = await downloadMedia(mediaId);

      if (mimeType.startsWith("audio/") || mimeType.startsWith("video/ogg")) {
        logger.info({ submissionId, mediaId }, "AI pipeline: transcribing audio");
        const transcript = await transcribeAudio(openai, buffer, mimeType);
        transcripts.push(transcript);

        await db
          .update(submissionsTable)
          .set({ voiceTranscript: transcripts.join(" "), updatedAt: new Date() })
          .where(eq(submissionsTable.id, submissionId));
      } else if (mimeType.startsWith("image/")) {
        logger.info({ submissionId, mediaId }, "AI pipeline: describing image");
        const [description, storedPath] = await Promise.all([
          describeImage(openai, buffer, mimeType, ctx),
          uploadImageBuffer(buffer, mimeType),
        ]);
        imageDescriptions.push(description);
        if (storedPath) {
          bodyImagePaths.push(storedPath);
          logger.info({ submissionId, storedPath }, "AI pipeline: image stored as body image");
        }
      }
    } catch (err) {
      logger.error({ err, submissionId, mediaId }, "AI pipeline: media processing failed");
    }
  }

  // --- Build combined text for AI stages ---
  // Text and voice transcripts are the PRIMARY story source.
  // Image descriptions are SUPPLEMENTARY context — only the lead story if no text/audio exists.
  const textParts = [rawText, ...transcripts].filter(Boolean);
  const hasText = textParts.length > 0;
  const hasImages = imageDescriptions.length > 0;

  let combinedText: string;
  if (hasText && hasImages) {
    // Text leads — image is supporting context only
    combinedText =
      `[COMMUNITY MEMBER'S MESSAGE — primary story source]\n${textParts.join("\n\n")}` +
      `\n\n[ATTACHED PHOTO — supporting visual context only, do not make this the story angle]\n${imageDescriptions.join("\n\n")}`;
  } else if (hasText) {
    combinedText = textParts.join("\n\n");
  } else if (hasImages) {
    // No text — image is all we have, let it lead
    combinedText = `[ATTACHED PHOTO — only source of information for this submission]\n${imageDescriptions.join("\n\n")}`;
  } else {
    combinedText = "";
  }

  if (!combinedText.trim()) {
    await db
      .update(submissionsTable)
      .set({ status: "rejected", rejectionReason: "No processable content found", updatedAt: new Date() })
      .where(eq(submissionsTable.id, submissionId));

    await sendTextMessage(
      phoneNumber,
      "We couldn't process your submission as no content was found. Please send a text message, photo, or voice note with your story.",
    ).catch(() => {});
    return;
  }

  // --- Resolve categories from DB (used by tone classifier + matching) ---
  const allCategories = await db.select().from(categoriesTable);

  // --- Stage 4: Tone classification ---
  logger.info({ submissionId }, "AI pipeline: classifying tone");
  const toneResult = await classifyTone(openai, combinedText, ctx, allCategories);

  // --- Stage 5: Information extraction ---
  logger.info({ submissionId }, "AI pipeline: extracting info");
  const infoResult = await extractInfo(openai, combinedText, ctx);

  // --- Resolve category ---
  const matchedCategory =
    allCategories.find(
      (c) => c.name.toLowerCase() === toneResult.suggestedCategory.toLowerCase(),
    ) ?? allCategories[0];

  // --- Stage 6: Load golden examples for this category ---
  const examples = await db
    .select({ inputText: goldenExamplesTable.inputText, outputText: goldenExamplesTable.outputText })
    .from(goldenExamplesTable)
    .where(eq(goldenExamplesTable.categoryId, matchedCategory?.id ?? 0))
    .orderBy(desc(goldenExamplesTable.createdAt))
    .limit(3);

  // --- Stage 7: Write article ---
  // Minimal mode activates when submission is thin (not all 4 completeness criteria met)
  // to prevent padding and hallucination on weak input
  const minimalMode = infoResult.completenessScore <= 0.75;
  logger.info({ submissionId, minimalMode }, "AI pipeline: writing article");
  const articleBody = await writeArticle(openai, combinedText, infoResult, toneResult, examples, ctx, minimalMode);

  // --- Stage 7b: Fact-check ---
  logger.info({ submissionId }, "AI pipeline: fact-checking article");
  const factCheck = await factCheckArticle(openai, combinedText, articleBody, ctx);
  if (factCheck.result === "FAIL") {
    logger.warn({ submissionId, issues: factCheck.issues }, "AI pipeline: fact-check FAILED — article will be held for review");
  } else {
    logger.info({ submissionId }, "AI pipeline: fact-check PASSED");
  }

  // --- Stage 8: Confidence score and routing ---
  const confidence =
    (infoResult.completenessScore * 0.5 +
      toneResult.confidence * 0.3 +
      Math.min(infoResult.wordCount / 50, 1) * 0.2);

  logger.info({ submissionId, confidence }, "AI pipeline: routing decision");

  if (confidence < 0.4) {
    // Reject — not enough content
    await db
      .update(submissionsTable)
      .set({
        status: "rejected",
        rejectionReason: "Insufficient information to create a publishable article",
        updatedAt: new Date(),
      })
      .where(eq(submissionsTable.id, submissionId));

    await sendTextMessage(
      phoneNumber,
      "Thanks for reaching out! We didn't have enough information to create a story from your submission. Could you share more details — what happened, where, and when? 📝",
    ).catch(() => {});

    return;
  }

  // --- Create the post ---
  // Fact-check FAIL forces "held" — editor must review before the article can go live
  const postStatus = (confidence >= 0.75 && factCheck.result === "PASS") ? "published" : "held";

  // --- Stage 7.5: Entity matching (with centrality check) ---
  logger.info({ submissionId }, "AI pipeline: matching entities");
  const entityMatch = await matchEntityInArticle(articleBody, openai);
  const entityImagePath = entityMatch?.entityImageUrl ?? null;

  // --- Stage 7b: Generate header image ---
  // Header is always a purpose-built wide image (entity image or DALL·E from asset library).
  // Submitted WhatsApp photos go into bodyImages — displayed inline in the article body.
  // For held articles we save the prompt text only — image is sourced from the library when admin publishes.
  let headerImagePath: string | null = entityImagePath ?? null;
  let headerImagePrompt: string | null = null;
  if (!entityImagePath) {
    headerImagePrompt = buildDallePrompt(infoResult.headline, infoResult.keyFacts, toneResult.tone);
    if (postStatus === "published") {
      const autoGenerate = await getSettingValue("auto_generate_images");
      if (autoGenerate === "true") {
        logger.info({ submissionId }, "AI pipeline: sourcing header image from asset library");
        const asset = await findOrCreateHeaderAsset(openai, infoResult.headline, infoResult.keyFacts, toneResult.tone, ctx);
        if (asset) {
          headerImagePath = asset.imageUrl;
          headerImagePrompt = asset.imagePrompt;
        }
      }
    } else {
      logger.info({ submissionId }, "AI pipeline: skipping header image — article held for review");
    }
  } else {
    logger.info({ submissionId, entityName: entityMatch?.entityName }, "AI pipeline: using entity image as header");
  }

  const [newPost] = await db
    .insert(postsTable)
    .values({
      title: infoResult.headline,
      slug:
        infoResult.headline
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Date.now().toString(36),
      body: articleBody,
      excerpt: articleBody.split(". ").slice(0, 2).join(". ") + ".",
      status: postStatus,
      confidenceScore: confidence.toFixed(2),
      wordCount: infoResult.wordCount,
      primaryCategoryId: matchedCategory?.id ?? null,
      sourceSubmissionId: submissionId,
      publishedAt: postStatus === "published" ? new Date() : null,
      matchedEntityId: entityMatch?.entityId ?? null,
      headerImageUrl: headerImagePath ?? undefined,
      imagePrompt: headerImagePrompt ?? undefined,
      bodyImages: bodyImagePaths,
    })
    .returning();

  // --- Update submission status ---
  await db
    .update(submissionsTable)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- Create event record (tone === "event" OR any tone with a date mentioned) ---
  await maybeCreateEventRecord(
    newPost.id,
    infoResult.headline,
    toneResult.tone,
    combinedText,
    openai,
    ctx,
    infoResult.eventDate,
    infoResult.hasDateTime,
  ).catch((err) => logger.warn({ err, postId: newPost.id }, "AI pipeline: event record creation failed (non-fatal)"));

  logger.info({ submissionId, postId: newPost.id, status: postStatus }, "AI pipeline: complete");

  // --- Generate social captions + post to Facebook (auto-published WhatsApp) ---
  if (postStatus === "published") {
    (async () => {
      try {
        await generateAndStoreSocialCaptions({
          id: newPost.id,
          title: newPost.title,
          body: newPost.body ?? "",
          excerpt: newPost.excerpt,
        });
        const captions = await getSocialCaptionsForPost(newPost.id);
        await postToFacebookPage({
          title: newPost.title,
          slug: newPost.slug,
          excerpt: newPost.excerpt,
          overrideMessage: captions?.captionFacebook ?? undefined,
          headerImageUrl: newPost.headerImageUrl,
          bodyImages: newPost.bodyImages,
        });
      } catch { /* non-fatal */ }
    })();
  }

  // --- Notify the submitter ---
  if (postStatus === "published") {
    const siteUrl = (await getSettingValue("platform_url")) ?? "https://whatsuptallaght.ie";
    const articleUrl = `${siteUrl}/article/${newPost.slug}`;
    await sendTextMessage(
      phoneNumber,
      `✅ Your story is live on Tallaght Community!\n\n"${infoResult.headline}"\n\n🔗 ${articleUrl}\n\nFeel free to share it with friends and family! 🏘️`,
    ).catch(() => {});
  } else {
    await sendTextMessage(
      phoneNumber,
      `📬 Thanks! We received your story and it's under review by our editors.\n\n"${infoResult.headline}"\n\nWe'll let you know once it's published.`,
    ).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// RSS submission pipeline
// ---------------------------------------------------------------------------

export interface RssPipelinePayload {
  submissionId: number;
  rssItemId: number;
  feedId: number;
  feedName: string;
  feedUrl: string;
  trustLevel: "official" | "news" | "general";
  title: string;
  content: string;
  link: string;
}

export async function processRssSubmission(payload: RssPipelinePayload & { jobId?: number }): Promise<void> {
  const { submissionId, rssItemId, feedName, feedUrl, trustLevel, title, content, link, jobId } = payload;
  const ctx: UsageCtx = { submissionId, jobId };

  logger.info({ submissionId, feedName }, "RSS pipeline: starting");

  const [submission] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.id, submissionId))
    .limit(1);

  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  await db
    .update(submissionsTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  const openai = await getOpenAI();

  // --- Safety check (lightweight — RSS sources are semi-trusted) ---
  const combinedText = [title, content].filter(Boolean).join(" ");
  const safety = await runSafetyCheck(openai, combinedText);

  if (!safety.passed) {
    logger.warn({ submissionId, reason: safety.reason }, "RSS pipeline: safety check failed");
    await db
      .update(submissionsTable)
      .set({ status: "rejected", safetyCheckPassed: "false", rejectionReason: safety.reason, updatedAt: new Date() })
      .where(eq(submissionsTable.id, submissionId));
    return;
  }

  await db
    .update(submissionsTable)
    .set({ safetyCheckPassed: "true", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- Resolve categories from DB ---
  const allCategories = await db.select().from(categoriesTable);

  // --- Tone + info extraction ---
  const [toneResult, infoResult] = await Promise.all([
    classifyTone(openai, combinedText, ctx, allCategories),
    extractInfo(openai, combinedText, ctx),
  ]);

  // --- Resolve category ---
  const matchedCategory =
    allCategories.find(
      (c) => c.name.toLowerCase() === toneResult.suggestedCategory.toLowerCase(),
    ) ?? allCategories[0];

  // --- Rewrite in community voice ---
  const systemPrompt = [
    "You are an editor for Tallaght Community, a local news platform for Tallaght, Dublin, Ireland.",
    `The following content is sourced from: ${feedName}.`,
    "Rewrite it as a clear, community-focused article. Remove formal/official language. Make it readable for local residents.",
    "Keep all facts accurate — do not add or invent anything.",
    "Write 100–300 words. Output the article body only — no headline, no byline.",
    link ? `Original source: ${link}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const rssArticleResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: combinedText },
    ],
  });

  logUsage(ctx, "gpt-4o-mini", "rss_rewrite", rssArticleResponse.usage ?? undefined);
  const articleBody = rssArticleResponse.choices[0].message.content?.trim() ?? content;

  // --- Fact-check ---
  const rssfactCheck = await factCheckArticle(openai, combinedText, articleBody, ctx);
  if (rssfactCheck.result === "FAIL") {
    logger.warn({ submissionId, issues: rssfactCheck.issues }, "RSS pipeline: fact-check FAILED — article will be held for review");
  }

  // --- Confidence and routing ---
  // Official sources get auto-published; news/general sources are held for review
  // Fact-check FAIL forces "held" regardless of confidence
  const baseConfidence = trustLevel === "official" ? 0.85 : trustLevel === "news" ? 0.6 : 0.5;
  const confidence = Math.min(1, baseConfidence + infoResult.completenessScore * 0.15);
  const postStatus = (confidence >= 0.75 && rssfactCheck.result === "PASS") ? "published" : "held";

  // --- Entity matching (with centrality check) ---
  const rssEntityMatch = await matchEntityInArticle(articleBody, openai);
  const rssEntityImagePath = rssEntityMatch?.entityImageUrl ?? null;

  // --- Generate header image (only for articles that will be published) ---
  // Precedence: entity image > DALL·E asset library > none
  // For held articles we save the prompt text only — image is sourced from library when admin publishes.
  let rssImagePath: string | null = rssEntityImagePath ?? null;
  let rssImagePrompt: string | null = buildDallePrompt(infoResult.headline || title, infoResult.keyFacts, toneResult.tone);
  if (!rssEntityImagePath) {
    if (postStatus === "published") {
      const autoGenerate = await getSettingValue("auto_generate_images");
      if (autoGenerate === "true") {
        logger.info({ submissionId }, "RSS pipeline: sourcing header image from asset library");
        const asset = await findOrCreateHeaderAsset(openai, infoResult.headline || title, infoResult.keyFacts, toneResult.tone, ctx);
        if (asset) {
          rssImagePath = asset.imageUrl;
          rssImagePrompt = asset.imagePrompt;
        }
      }
    } else {
      logger.info({ submissionId }, "RSS pipeline: skipping image generation — article held for review");
    }
  } else {
    logger.info({ submissionId, entityName: rssEntityMatch?.entityName }, "RSS pipeline: using entity image as header");
  }

  const slug =
    infoResult.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);

  const [newPost] = await db
    .insert(postsTable)
    .values({
      title: infoResult.headline || title,
      slug,
      body: articleBody,
      excerpt: articleBody.split(". ").slice(0, 2).join(". ") + ".",
      status: postStatus,
      confidenceScore: confidence.toFixed(2),
      wordCount: articleBody.split(/\s+/).length,
      primaryCategoryId: matchedCategory?.id ?? null,
      sourceSubmissionId: submissionId,
      publishedAt: postStatus === "published" ? new Date() : null,
      matchedEntityId: rssEntityMatch?.entityId ?? null,
      headerImageUrl: rssEntityImagePath ?? rssImagePath ?? undefined,
      imagePrompt: rssImagePrompt ?? undefined,
    })
    .returning();

  // Update submission
  await db
    .update(submissionsTable)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // Update rss_item with post reference
  await db
    .update(rssItemsTable)
    .set({ postId: newPost.id })
    .where(eq(rssItemsTable.id, rssItemId));

  // --- Create event record if tone === "event" ---
  await maybeCreateEventRecord(
    newPost.id,
    infoResult.headline || title,
    toneResult.tone,
    combinedText,
    openai,
    ctx,
    infoResult.eventDate,
    infoResult.hasDateTime,
  ).catch((err) => logger.warn({ err, postId: newPost.id }, "RSS pipeline: event record creation failed (non-fatal)"));

  // --- Generate social captions + post to Facebook (auto-published RSS) ---
  if (postStatus === "published") {
    (async () => {
      try {
        await generateAndStoreSocialCaptions({
          id: newPost.id,
          title: newPost.title,
          body: newPost.body ?? "",
          excerpt: newPost.excerpt,
        });
        const captions = await getSocialCaptionsForPost(newPost.id);
        await postToFacebookPage({
          title: newPost.title,
          slug: newPost.slug,
          excerpt: newPost.excerpt,
          overrideMessage: captions?.captionFacebook ?? undefined,
          headerImageUrl: newPost.headerImageUrl,
          bodyImages: newPost.bodyImages,
        });
      } catch { /* non-fatal */ }
    })();
  }

  logger.info(
    { submissionId, postId: newPost.id, status: postStatus, feedName },
    "RSS pipeline: complete",
  );
}

// ---------------------------------------------------------------------------
// Standalone: regenerate header image for an existing post (admin action)
// ---------------------------------------------------------------------------

export async function regeneratePostImage(
  postId: number,
  headline: string,
  keyFacts: string[],
  tone: string,
  submissionId: number,
): Promise<{ imageUrl: string; imagePrompt: string } | null> {
  const openai = await getOpenAI();
  const ctx: UsageCtx = { submissionId };
  return generateHeaderImage(openai, headline, keyFacts, tone, ctx);
}
