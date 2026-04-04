import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  eventsTable,
  postsTable,
  categoriesTable,
  aiUsageLogTable,
} from "@workspace/db/schema";
import { eq, gte, lte, and, asc } from "drizzle-orm";
import { logger } from "./logger";
import { getSettingValue } from "../routes/settings";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns true if the date falls within Irish Summer Time (UTC+1) */
function isIrishSummerTime(d: Date): boolean {
  // DST: last Sunday in March → last Sunday in October
  const year = d.getFullYear();
  function lastSunday(month: number): Date {
    const lastDay = new Date(year, month + 1, 0);
    return new Date(year, month, lastDay.getDate() - lastDay.getDay());
  }
  const dstStart = lastSunday(2); // last Sunday in March
  const dstEnd = lastSunday(9);   // last Sunday in October
  return d >= dstStart && d < dstEnd;
}

/** Get the current Dublin local time */
function getDublinNow(): Date {
  const now = new Date();
  const offsetMs = isIrishSummerTime(now) ? 60 * 60 * 1000 : 0;
  return new Date(now.getTime() + offsetMs);
}

/**
 * Returns upcoming Friday, Saturday, Sunday dates relative to "now" in Dublin time.
 * If it's already Saturday/Sunday, returns the current weekend.
 */
function getWeekendDates(): { friday: string; saturday: string; sunday: string } {
  const d = getDublinNow();
  const day = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat

  // Days until the next/current Saturday
  const daysUntilSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const sat = new Date(d);
  sat.setDate(d.getDate() + daysUntilSat);
  sat.setHours(0, 0, 0, 0);

  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  const fri = new Date(sat);
  fri.setDate(sat.getDate() - 1);

  const fmt = (dt: Date) => dt.toISOString().split("T")[0];
  return { friday: fmt(fri), saturday: fmt(sat), sunday: fmt(sun) };
}

// ---------------------------------------------------------------------------
// Category — ensure "Weekend Guide" exists
// ---------------------------------------------------------------------------

async function getOrCreateWeekendGuideCategory(): Promise<number> {
  const [existing] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, "weekend-guide"))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(categoriesTable)
    .values({
      name: "Weekend Guide",
      slug: "weekend-guide",
      color: "#16a34a",
      description:
        "Your weekly guide to things happening in Tallaght this weekend — " +
        "events, activities, sport, family days out and more.",
    })
    .returning({ id: categoriesTable.id });

  logger.info("Weekend roundup: created 'Weekend Guide' category");
  return created.id;
}

// ---------------------------------------------------------------------------
// Deduplication — has a roundup already been created this week?
// ---------------------------------------------------------------------------

async function alreadyGeneratedThisWeek(categoryId: number): Promise<boolean> {
  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  const [existing] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.primaryCategoryId, categoryId),
        gte(postsTable.createdAt, sixDaysAgo),
      ),
    )
    .limit(1);

  return !!existing;
}

// ---------------------------------------------------------------------------
// Fetch upcoming weekend events (Fri + Sat + Sun)
// ---------------------------------------------------------------------------

type WeekendEvent = {
  title: string;
  eventDate: string;
  eventTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  organiser: string | null;
  price: string | null;
  websiteUrl: string | null;
};

async function fetchWeekendEvents(
  friday: string,
  sunday: string,
): Promise<WeekendEvent[]> {
  return db
    .select({
      title: eventsTable.title,
      eventDate: eventsTable.eventDate,
      eventTime: eventsTable.eventTime,
      endTime: eventsTable.endTime,
      location: eventsTable.location,
      description: eventsTable.description,
      organiser: eventsTable.organiser,
      price: eventsTable.price,
      websiteUrl: eventsTable.websiteUrl,
    })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.eventDate, friday),
        lte(eventsTable.eventDate, sunday),
        eq(eventsTable.status, "upcoming"),
      ),
    )
    .orderBy(asc(eventsTable.eventDate), asc(eventsTable.eventTime));
}

// ---------------------------------------------------------------------------
// Format an event for the GPT prompt
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function buildEventsBlock(events: WeekendEvent[]): string {
  if (events.length === 0) return "No events have been submitted yet this week.";
  return events
    .map((e) => {
      const lines = [`EVENT: ${e.title}`];
      if (e.eventDate) lines.push(`Date: ${fmtDate(e.eventDate)}`);
      if (e.eventTime) lines.push(`Time: ${e.eventTime}${e.endTime ? ` – ${e.endTime}` : ""}`);
      if (e.location) lines.push(`Venue: ${e.location}`);
      if (e.price) lines.push(`Price: ${e.price}`);
      if (e.organiser) lines.push(`Organiser: ${e.organiser}`);
      if (e.description) lines.push(`Details: ${e.description}`);
      if (e.websiteUrl) lines.push(`More info: ${e.websiteUrl}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// GPT-4o article generation
// ---------------------------------------------------------------------------

async function generateRoundupArticle(
  events: WeekendEvent[],
  whatsappNumber: string,
): Promise<{ title: string; body: string; slug: string } | null> {
  const apiKey = await getSettingValue("openai_api_key");
  if (!apiKey) {
    logger.warn("Weekend roundup: OpenAI API key not configured");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  const cta =
    `\n\nGot an event happening in Tallaght? We'd love to include it. ` +
    `Send the details to us on WhatsApp at ${whatsappNumber} and we'll get it listed.`;

  const eventsBlock = buildEventsBlock(events);

  const systemPrompt = [
    "You are the editor of Tallaght Community, a hyper-local news platform for Tallaght, Dublin.",
    "Every week you write a 'Things to Do This Weekend' roundup article.",
    "",
    "RULES:",
    "- Tone: warm, welcoming, and genuinely enthusiastic about Tallaght — like a local who knows the area well.",
    "- Write in flowing paragraphs. NO bullet points, NO headers inside the body.",
    "- Start with an engaging intro sentence or two about the weekend ahead.",
    "- Dedicate a short paragraph to each event, weaving in all the key facts naturally.",
    "- Friday evening events should be described as 'kicking off the weekend on Friday evening'.",
    "- If there is only one event, write warmly about it with full detail, then use the remaining space",
    "  to speak directly to the community — encourage people to submit their events for next week.",
    "- End with the call-to-action paragraph provided — include it exactly as given.",
    "- Length: 200–450 words total.",
    "- Output the article body ONLY — no headline, no byline, no markdown formatting.",
  ].join("\n");

  const userPrompt =
    `Write a 'Things to Do in Tallaght This Weekend' article using the following events:\n\n` +
    eventsBlock +
    `\n\nCall to action to include verbatim at the end:\n${cta}`;

  let body = "";
  let usage: { prompt_tokens: number; completion_tokens: number } | null = null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    body = response.choices[0].message.content?.trim() ?? "";
    usage = response.usage
      ? { prompt_tokens: response.usage.prompt_tokens, completion_tokens: response.usage.completion_tokens }
      : null;
  } catch (err) {
    logger.error({ err }, "Weekend roundup: GPT-4o call failed");
    return null;
  }

  // Log AI usage
  if (usage) {
    const costUsd = (
      usage.prompt_tokens * 0.0000025 +
      usage.completion_tokens * 0.00001
    ).toFixed(6);
    await db
      .insert(aiUsageLogTable)
      .values({
        model: "gpt-4o",
        stage: "weekend_roundup",
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        estimatedCostUsd: costUsd,
      })
      .catch((err) => logger.warn({ err }, "Weekend roundup: failed to log AI usage"));
  }

  // Build SEO-friendly title and slug
  const dublinNow = getDublinNow();
  const dateLabel = dublinNow.toLocaleDateString("en-IE", { day: "numeric", month: "long" });
  const title = `Things to Do in Tallaght This Weekend – ${dateLabel}`;
  const slug = `things-to-do-tallaght-this-weekend-${dublinNow.getFullYear()}-${String(dublinNow.getMonth() + 1).padStart(2, "0")}-${String(dublinNow.getDate()).padStart(2, "0")}`;

  return { title, body, slug };
}

// ---------------------------------------------------------------------------
// Core check — runs on every poll tick
// ---------------------------------------------------------------------------

async function runRoundupCheck(): Promise<void> {
  const dublinNow = getDublinNow();
  const dayOfWeek = dublinNow.getDay(); // 0=Sun,4=Thu,5=Fri
  const hour = dublinNow.getHours();

  // Only act on Thursday (4) or Friday (5)
  if (dayOfWeek !== 4 && dayOfWeek !== 5) return;

  // Only fire between 8:00 and 10:59 Dublin time
  if (hour < 8 || hour >= 11) return;

  const categoryId = await getOrCreateWeekendGuideCategory();

  // Already published one this week?
  if (await alreadyGeneratedThisWeek(categoryId)) {
    logger.debug("Weekend roundup: already generated this week — skipping");
    return;
  }

  const { friday, saturday, sunday } = getWeekendDates();
  const events = await fetchWeekendEvents(friday, sunday);
  const eventCount = events.length;

  // Thursday rule: need 3+ events (including Friday events) to fire early
  if (dayOfWeek === 4 && eventCount < 3) {
    logger.info(
      { eventCount },
      "Weekend roundup: Thursday — fewer than 3 events, deferring to Friday",
    );
    return;
  }

  logger.info({ dayOfWeek, eventCount }, "Weekend roundup: generating article");

  const whatsappNumber =
    (await getSettingValue("platform_whatsapp_display_number")) ?? "+353 85 714 1023";

  const article = await generateRoundupArticle(events, whatsappNumber);
  if (!article) return;

  const excerpt = article.body.split(". ").slice(0, 2).join(". ") + ".";

  await db.insert(postsTable).values({
    title: article.title,
    slug: article.slug,
    body: article.body,
    excerpt,
    status: "held",
    wordCount: article.body.split(/\s+/).length,
    primaryCategoryId: categoryId,
    isFeatured: false,
    publishedAt: null,
  });

  logger.info(
    { slug: article.slug, eventCount },
    "Weekend roundup: article created and held for admin review",
  );
}

// ---------------------------------------------------------------------------
// Public — start the scheduler
// ---------------------------------------------------------------------------

export function startWeekendRoundupScheduler(): void {
  logger.info("Weekend roundup scheduler started");

  // Poll every 30 minutes
  setInterval(() => {
    runRoundupCheck().catch((err) =>
      logger.error({ err }, "Weekend roundup: uncaught scheduler error"),
    );
  }, 30 * 60 * 1000);

  // Run once at boot to catch missed windows (e.g. server restarted mid-morning)
  runRoundupCheck().catch((err) =>
    logger.error({ err }, "Weekend roundup: startup check failed"),
  );
}
