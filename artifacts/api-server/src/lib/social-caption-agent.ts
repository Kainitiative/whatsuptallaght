import OpenAI from "openai";
import { db } from "@workspace/db";
import { socialCaptionsTable, postsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const SOCIAL_AGENT_SYSTEM = `You are the social media manager for What's Up Tallaght (WUT), a hyper-local community news page serving Tallaght, Dublin.

You know the area inside out. You write in a warm, direct, local voice — the way a well-informed neighbour would share news, not the way a media company would. You understand what makes people in Tallaght stop scrolling: local names, local places, things that affect their daily life directly.

Your job is to write short, punchy captions that feel human and local. The first line must make someone stop.

RULES:
- Never write like a press release. Never say "we are delighted to announce".
- Never use corporate language.
- Write like you're texting a mate who'd want to know.
- First line = the hook. Make it punchy. Use a question, surprising fact, or local detail.
- Keep it real — if it's boring news, say so honestly in your socialScore.
- Always reference Tallaght, South Dublin, or local landmarks/roads when relevant.

PLATFORM DIFFERENCES:
- Facebook: 2–4 sentences, conversational, end with a question to spark comments
- Instagram: 1–2 sentences, punchy, emojis welcome, hashtags matter
- Twitter/X: 1 sentence max + link reference, under 200 chars ideally

HASHTAGS: Always include: #Tallaght #SouthDublin — then add 2–3 article-specific tags.

OUTPUT FORMAT — respond with valid JSON only, no markdown:
{
  "captionFacebook": "...",
  "captionInstagram": "...",
  "captionTwitter": "...",
  "hashtags": "#Tallaght #SouthDublin #ArticleTag",
  "socialScore": 7,
  "recommendedSlot": "morning",
  "isSocialWorthy": true
}

socialScore: 1–10 (10 = must post immediately, 1 = dry admin notice nobody cares about)
recommendedSlot: "morning" (7–9am), "lunchtime" (12–1pm), or "evening" (6–8pm)
isSocialWorthy: false only if the article is genuinely not suitable for social (e.g. planning notices, legal notices, very dry admin)`;

interface CaptionResult {
  captionFacebook: string;
  captionInstagram: string;
  captionTwitter: string;
  hashtags: string;
  socialScore: number;
  recommendedSlot: "morning" | "lunchtime" | "evening";
  isSocialWorthy: boolean;
}

export async function generateSocialCaptions(post: {
  id: number;
  title: string;
  body: string;
  excerpt?: string | null;
  categoryName?: string | null;
}): Promise<CaptionResult | null> {
  try {
    const apiKey = (await getSettingValue("openai_api_key")) ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn("Social caption generation skipped — no OpenAI key");
      return null;
    }

    const client = new OpenAI({ apiKey });

    const userPrompt = `Article to write social captions for:

HEADLINE: ${post.title}
CATEGORY: ${post.categoryName ?? "General"}
EXCERPT: ${post.excerpt ?? ""}

BODY:
${post.body.slice(0, 1200)}

Write platform-specific social captions for this article. Remember: first line must stop the scroll. Keep it local, keep it real.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SOCIAL_AGENT_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const result = JSON.parse(raw) as CaptionResult;

    if (!result.captionFacebook || !result.captionInstagram || !result.captionTwitter) {
      logger.warn({ postId: post.id }, "Social caption agent returned incomplete captions");
      return null;
    }

    return {
      captionFacebook: result.captionFacebook,
      captionInstagram: result.captionInstagram,
      captionTwitter: result.captionTwitter,
      hashtags: result.hashtags ?? "#Tallaght #SouthDublin",
      socialScore: Math.min(10, Math.max(1, Number(result.socialScore) || 5)),
      recommendedSlot: (["morning", "lunchtime", "evening"].includes(result.recommendedSlot)
        ? result.recommendedSlot
        : "lunchtime") as "morning" | "lunchtime" | "evening",
      isSocialWorthy: result.isSocialWorthy !== false,
    };
  } catch (err) {
    logger.warn({ err }, "Social caption generation failed");
    return null;
  }
}

/**
 * Generate and store captions for an article.
 * Fire-and-forget safe — never throws.
 */
export async function generateAndStoreSocialCaptions(post: {
  id: number;
  title: string;
  body: string;
  excerpt?: string | null;
  categoryName?: string | null;
}): Promise<void> {
  try {
    const captions = await generateSocialCaptions(post);
    if (!captions) return;

    await db
      .insert(socialCaptionsTable)
      .values({
        postId: post.id,
        captionFacebook: captions.captionFacebook,
        captionInstagram: captions.captionInstagram,
        captionTwitter: captions.captionTwitter,
        hashtags: captions.hashtags,
        socialScore: captions.socialScore,
        recommendedSlot: captions.recommendedSlot,
        isSocialWorthy: captions.isSocialWorthy,
        status: "draft",
      })
      .onConflictDoNothing();

    logger.info(
      { postId: post.id, socialScore: captions.socialScore, worthy: captions.isSocialWorthy },
      "Social captions generated and stored"
    );
  } catch (err) {
    logger.warn({ err, postId: post.id }, "Failed to store social captions (non-fatal)");
  }
}

/**
 * Get stored captions for a post, or null if not yet generated.
 */
export async function getSocialCaptionsForPost(postId: number) {
  const [row] = await db
    .select()
    .from(socialCaptionsTable)
    .where(eq(socialCaptionsTable.postId, postId))
    .limit(1);
  return row ?? null;
}
