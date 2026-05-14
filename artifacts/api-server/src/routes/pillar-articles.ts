import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, categoriesTable, aiUsageLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { getSettingValue } from "./settings";

const router = Router();

// ── Pillar page registry ──────────────────────────────────────────────────────
// Add new pillar pages here — the admin UI reads this list automatically.

export const PILLAR_PAGES = [
  {
    id: "cocaine-support-tallaght",
    title: "Cocaine Support in Tallaght",
    description: "Awareness, support services, and recovery resources for cocaine addiction in Tallaght.",
    pageUrl: "/cocaine-support-tallaght",
    topic: "cocaine addiction awareness, support services, and recovery resources available in Tallaght, Dublin",
    keyPoints: [
      "Cocaine use has increased significantly in Ireland over the last decade",
      "57% of men entering residential treatment in Ireland were seeking help for cocaine addiction (Coolmine Therapeutic Community)",
      "Cocaine can cause anxiety, panic attacks, paranoia, and in severe cases cocaine psychosis",
      "Tallaght Rehabilitation Project (TRP) provides community-based addiction recovery and aftercare at Kiltalown House, Tallaght",
      "Tallaght Drug and Alcohol Task Force (TDATF) coordinates addiction response across the Tallaght area",
      "Free peer-support meetings available through Cocaine Anonymous and Narcotics Anonymous",
      "HSE South West Dublin Drug and Alcohol Service provides assessment and referral pathways",
      "HSE Drugs and Alcohol Helpline: 1800 459 459",
      "Recovery is possible — support, counselling, peer recovery, and community connection all help",
    ],
    tone: "community",
    suggestedCategory: "community",
  },
  {
    id: "cocaine-psychosis-brain-effects",
    title: "Cocaine Psychosis & Brain Effects",
    description: "How cocaine affects the brain, causes paranoia and psychosis, and what the research says.",
    pageUrl: "/cocaine-psychosis-brain-effects",
    topic: "how cocaine affects the brain, causes psychosis and paranoia, and the critical role of sleep deprivation in cocaine-related mental health decline",
    keyPoints: [
      "Cocaine psychosis is a severe psychological state involving hallucinations, paranoia, and temporary loss of touch with reality",
      "Paranoia is one of the most commonly reported psychological effects of repeated cocaine use",
      "Sleep deprivation dramatically intensifies cocaine-related paranoia, emotional instability, and psychological distress",
      "Cocaine floods the brain with dopamine — the chemical involved in pleasure, motivation, and reward — disrupting natural processing",
      "Long-term cocaine use is linked to difficulties with memory, impulse control, concentration, and emotional regulation",
      "Emotional crashes after use can create a dangerous cycle that leads to dependence",
      "The brain and body can recover with abstinence, proper sleep, counselling, and structured support",
      "If someone is experiencing hallucinations or severe paranoia: call 999 or 112 immediately",
    ],
    tone: "community",
    suggestedCategory: "community",
  },
];

// ── GET /admin/pillar-articles — list pillar pages ────────────────────────────
router.get("/admin/pillar-articles", (_req, res) => {
  res.json(PILLAR_PAGES);
});

// ── POST /admin/pillar-articles/:id/generate — generate article ───────────────
router.post("/admin/pillar-articles/:id/generate", async (req, res) => {
  const pillar = PILLAR_PAGES.find((p) => p.id === req.params.id);
  if (!pillar) {
    return res.status(404).json({ error: "not_found", message: "Pillar page not found" });
  }

  let openaiKey: string;
  try {
    openaiKey = await getSettingValue("openai_api_key");
    if (!openaiKey) throw new Error("missing");
  } catch {
    return res.status(503).json({ error: "config_error", message: "OpenAI API key is not configured" });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Find or resolve the community category
  let categoryId: number | null = null;
  try {
    const cats = await db
      .select({ id: categoriesTable.id, slug: categoriesTable.slug })
      .from(categoriesTable);
    const match =
      cats.find((c) => c.slug === pillar.suggestedCategory) ??
      cats.find((c) => c.slug === "community") ??
      cats[0] ??
      null;
    categoryId = match?.id ?? null;
  } catch {
    // non-fatal — article will just have no category
  }

  const siteUrl = "https://whatsuptallaght.ie";
  const fullPageUrl = `${siteUrl}${pillar.pageUrl}`;

  const prompt = `You are a journalist writing for What's Up Tallaght (WUT), a hyper-local community news website serving Tallaght, Dublin.

Write a community news article about the following topic: ${pillar.topic}.

The article should:
- Be warm, non-judgmental, and community-focused in tone
- Be written for a Tallaght audience — local, direct, and human
- Be approximately 400–500 words in the body
- Include a clear, compelling headline (not clickbait — informative and honest)
- Open with a strong first paragraph that hooks the reader and explains why this matters locally
- Cover the key points naturally within the article (do not list them as bullet points — weave them into flowing prose)
- End with a clear call to action pointing readers to the full guide at: ${fullPageUrl}
- NOT be sensationalist, fearful, or preachy — this is about awareness and support

Key points to cover:
${pillar.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Return a JSON object with exactly these fields:
{
  "title": "The article headline (50-80 characters ideal)",
  "excerpt": "A 1-2 sentence summary for previews and social sharing (under 160 characters)",
  "body": "The full article body in plain paragraphs separated by double newlines. No markdown. No bullet lists. Just clean prose."
}`;

  let title: string;
  let excerpt: string;
  let body: string;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    inputTokens = response.usage?.prompt_tokens ?? 0;
    outputTokens = response.usage?.completion_tokens ?? 0;

    const raw = JSON.parse(response.choices[0].message.content ?? "{}");
    title = String(raw.title ?? "").trim();
    excerpt = String(raw.excerpt ?? "").trim();
    body = String(raw.body ?? "").trim();

    if (!title || !body) {
      return res.status(502).json({ error: "ai_error", message: "AI returned incomplete content" });
    }
  } catch (err: any) {
    return res.status(502).json({ error: "ai_error", message: err?.message ?? "OpenAI call failed" });
  }

  // Generate a unique slug
  const baseSlug = `${pillar.id}-article-${Date.now()}`;
  const slug = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  let post: typeof postsTable.$inferSelect;
  try {
    [post] = await db
      .insert(postsTable)
      .values({
        title,
        slug,
        body,
        excerpt: excerpt || null,
        status: "draft",
        tone: pillar.tone,
        primaryCategoryId: categoryId,
        wordCount,
        confidenceScore: "90.00",
      })
      .returning();
  } catch (err: any) {
    return res.status(500).json({ error: "db_error", message: err?.message ?? "Failed to save article" });
  }

  // Log AI usage (non-fatal)
  try {
    const costPerInputToken = 2.5 / 1_000_000;
    const costPerOutputToken = 10 / 1_000_000;
    const costUsd = inputTokens * costPerInputToken + outputTokens * costPerOutputToken;
    await db.insert(aiUsageLogTable).values({
      submissionId: null,
      jobId: null,
      model: "gpt-4o",
      stage: "pillar_article_generation",
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd.toFixed(6),
    });
  } catch {
    // non-fatal
  }

  res.json({
    post,
    articleUrl: `/article/${post.slug}`,
    reviewUrl: `/review`,
  });
});

export default router;
