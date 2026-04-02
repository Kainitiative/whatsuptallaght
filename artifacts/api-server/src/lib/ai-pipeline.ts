import OpenAI, { toFile } from "openai";
import { db } from "@workspace/db";
import {
  submissionsTable,
  postsTable,
  categoriesTable,
  goldenExamplesTable,
  rssItemsTable,
  aiUsageLogTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSettingValue } from "../routes/settings";
import { downloadMedia } from "./whatsapp-client";
import { sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";

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
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          },
          {
            type: "text",
            text: "Describe this image in detail for a local community news article. Focus on: any visible text, people, events, locations, damage, activities, or anything newsworthy about the Tallaght/Dublin area. Be factual and specific. If the image is not newsworthy or unclear, say so briefly.",
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
    "Write a clean, factual, community-focused article based on the submission below.",
    "",
    "Guidelines:",
    "- Write in third person, past or present tense as appropriate",
    "- Keep it factual — only state what is in the submission, do not invent details",
    "- Write 150–400 words unless the submission warrants less",
    "- Use clear, plain language — this is for a general community audience",
    "- Do not use clickbait, sensationalism, or excessive superlatives",
    "- Credit the source as 'a local resident', 'a community member', or specific name if given",
    "- For events: include date, time, location, and what people need to know",
    "- For news: include who, what, where, when, and impact on the community",
    "- Output the article body only — no headline, no byline, no category label",
    ...(examplesBlock
      ? ["", "Reference these published examples for the correct style and tone:", examplesBlock]
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
        const description = await describeImage(openai, buffer, mimeType, ctx);
        imageDescriptions.push(description);
      }
    } catch (err) {
      logger.error({ err, submissionId, mediaId }, "AI pipeline: media processing failed");
    }
  }

  // --- Build combined text for AI stages ---
  const combinedParts = [rawText, ...transcripts, ...imageDescriptions].filter(Boolean);
  const combinedText = combinedParts.join("\n\n");

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
    })
    .returning();

  // --- Update submission status ---
  await db
    .update(submissionsTable)
    .set({ status: "processed", updatedAt: new Date() })
    .where(eq(submissionsTable.id, submissionId));

  logger.info({ submissionId, postId: newPost.id, status: postStatus }, "AI pipeline: complete");

  // --- Notify the submitter ---
  if (postStatus === "published") {
    await sendTextMessage(
      phoneNumber,
      `✅ Your story is live!\n\n"${infoResult.headline}"\n\nThank you for contributing to Tallaght Community! 🏘️`,
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

  logger.info(
    { submissionId, postId: newPost.id, status: postStatus, feedName },
    "RSS pipeline: complete",
  );
}
