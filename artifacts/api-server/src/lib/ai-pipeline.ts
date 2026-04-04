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
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSettingValue } from "../routes/settings";
import { downloadMedia } from "./whatsapp-client";
import { sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";
import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Server-side image upload to GCS
// ---------------------------------------------------------------------------

async function uploadImageBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!bucketId || !privateDir) {
      logger.warn("Object storage not configured — image will not be saved");
      return null;
    }

    // Apply the What's Up Tallaght watermark before storing
    const watermarked = await applyWatermark(buffer);

    const objectId = randomUUID();
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
  "completenessScore": number (0–1, how complete and publishable is this information)
}`,
      },
      { role: "user", content: combinedText },
    ],
  });

  logUsage(ctx, "gpt-4o-mini", "info_extract", response.usage ?? undefined);
  try {
    return JSON.parse(response.choices[0].message.content ?? "{}") as ExtractedInfo;
  } catch {
    return {
      headline: "Community Update",
      location: null,
      eventDate: null,
      keyFacts: [],
      sentiment: "neutral",
      wordCount: combinedText.split(" ").length,
      completenessScore: 0.3,
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

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
): Promise<void> {
  if (tone !== "event") return;

  const details = await extractEventDetails(openai, combinedText, ctx);
  if (!details) return;

  const eventDate = details.eventDate ?? infoEventDate;
  if (!eventDate) {
    logger.warn({ postId }, "AI pipeline: event detected but no date found — skipping event record");
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

function buildDallePrompt(headline: string, keyFacts: string[], tone: string): string {
  const facts = keyFacts.slice(0, 3).filter(Boolean).join(", ");
  const styleByTone: Record<string, string> = {
    news: "editorial documentary photography, realistic, candid community scene",
    event: "community event photography, bright and welcoming atmosphere, people gathered",
    sport: "sports action photography, outdoor pitch, athletic movement",
    community: "community documentary photography, warm neighbourhood feel",
    business: "local business photography, storefront or interior, professional",
    warning: "documentary photography, Tallaght street scene, overcast mood",
    memorial: "respectful and dignified photography, flowers, quiet public space",
    other: "photorealistic community news photography, Irish urban setting",
  };
  const style = styleByTone[tone] ?? styleByTone.other;
  const factsClause = facts ? ` Scene relates to: ${facts}.` : "";
  return `${style}. Subject: ${headline}.${factsClause} Set in Tallaght or Dublin, Ireland. No text overlays, no watermarks, no readable signs, no identifiable faces. High-quality editorial photography, natural lighting.`;
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
    const prompt = buildDallePrompt(headline, keyFacts, tone);
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
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
// Stage 6 — Article writing (GPT-4o)
// ---------------------------------------------------------------------------

async function writeArticle(
  openai: OpenAI,
  combinedText: string,
  info: ExtractedInfo,
  tone: ToneResult,
  goldenExamples: { inputText: string; outputText: string }[],
  ctx: UsageCtx,
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

  const systemPrompt = [
    "You are an editor for Tallaght Community, a local news platform for Tallaght, Dublin, Ireland.",
    "Your job is to rewrite community submissions into clean, readable news articles.",
    "",
    "VOICE: Tallaght Community writes like a local person sharing real updates — clear, simple, and grounded. It should feel like something you'd read on Facebook or hear from a neighbour.",
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
    "2. LENGTH must match the source. Short submission = short article.",
    "   - A one-sentence submission should produce a 2–4 sentence article. Do not pad it.",
    "   - A detailed submission can produce up to 300 words. Never exceed 400 words.",
    "   - Do not add paragraphs of background context to fill space.",
    "",
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
  let firstImagePath: string | null = null; // saved to GCS for use as article header

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
        if (!firstImagePath && storedPath) {
          firstImagePath = storedPath;
          logger.info({ submissionId, storedPath }, "AI pipeline: image uploaded to storage");
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
  logger.info({ submissionId }, "AI pipeline: writing article");
  const articleBody = await writeArticle(openai, combinedText, infoResult, toneResult, examples, ctx);

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
  const postStatus = confidence >= 0.75 ? "published" : "held";

  // --- Stage 7.5: Entity matching (with centrality check) ---
  logger.info({ submissionId }, "AI pipeline: matching entities");
  const entityMatch = await matchEntityInArticle(articleBody, openai);
  const entityImagePath = entityMatch?.entityImageUrl ?? null;

  // --- Stage 7b: Generate header image (only for articles that will be published) ---
  // Precedence: submitted photo > entity image > DALL·E generated > none
  // For held articles we save the prompt text only — image is generated when admin publishes.
  let generatedImagePath: string | null = null;
  let generatedImagePrompt: string | null = null;
  if (!firstImagePath && !entityImagePath) {
    // Always build and store the prompt so it's ready when the article is published
    generatedImagePrompt = buildDallePrompt(infoResult.headline, infoResult.keyFacts, toneResult.tone);
    if (postStatus === "published") {
      const autoGenerate = await getSettingValue("auto_generate_images");
      if (autoGenerate === "true") {
        logger.info({ submissionId }, "AI pipeline: generating header image (auto-published)");
        const generated = await generateHeaderImage(openai, infoResult.headline, infoResult.keyFacts, toneResult.tone, ctx);
        if (generated) {
          generatedImagePath = generated.imageUrl;
          generatedImagePrompt = generated.imagePrompt;
        }
      }
    } else {
      logger.info({ submissionId }, "AI pipeline: skipping image generation — article held for review");
    }
  } else if (!firstImagePath && entityImagePath) {
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
      headerImageUrl: firstImagePath ?? entityImagePath ?? generatedImagePath ?? undefined,
      imagePrompt: generatedImagePrompt ?? undefined,
    })
    .returning();

  // --- Update submission status ---
  await db
    .update(submissionsTable)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  // --- Create event record if tone === "event" ---
  await maybeCreateEventRecord(
    newPost.id,
    infoResult.headline,
    toneResult.tone,
    combinedText,
    openai,
    ctx,
    infoResult.eventDate,
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
        });
      } catch { /* non-fatal */ }
    })();
  }

  // --- Notify the submitter ---
  if (postStatus === "published") {
    const siteUrl = (await getSettingValue("site_url")) ?? "https://tallaghtcommunity.ie";
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

  // --- Confidence and routing ---
  // Official sources get auto-published; news/general sources are held for review
  const baseConfidence = trustLevel === "official" ? 0.85 : trustLevel === "news" ? 0.6 : 0.5;
  const confidence = Math.min(1, baseConfidence + infoResult.completenessScore * 0.15);
  const postStatus = confidence >= 0.75 ? "published" : "held";

  // --- Entity matching (with centrality check) ---
  const rssEntityMatch = await matchEntityInArticle(articleBody, openai);
  const rssEntityImagePath = rssEntityMatch?.entityImageUrl ?? null;

  // --- Generate header image (only for articles that will be published) ---
  // Precedence: entity image > DALL·E generated > none
  // For held articles we save the prompt text only — image is generated when admin publishes.
  let rssImagePath: string | null = null;
  let rssImagePrompt: string | null = buildDallePrompt(infoResult.headline || title, infoResult.keyFacts, toneResult.tone);
  if (!rssEntityImagePath) {
    if (postStatus === "published") {
      const autoGenerate = await getSettingValue("auto_generate_images");
      if (autoGenerate === "true") {
        logger.info({ submissionId }, "RSS pipeline: generating header image (auto-published)");
        const generated = await generateHeaderImage(openai, infoResult.headline || title, infoResult.keyFacts, toneResult.tone, ctx);
        if (generated) {
          rssImagePath = generated.imageUrl;
          rssImagePrompt = generated.imagePrompt;
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
