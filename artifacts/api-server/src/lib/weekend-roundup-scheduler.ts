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
import { getWeatherForDate, generateWeatherMessage, type DayForecast } from "../routes/weather";

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
// Fetch 3-day weekend weather forecast (Fri / Sat / Sun)
// ---------------------------------------------------------------------------

async function fetchWeekendWeather(
  friday: string,
  saturday: string,
  sunday: string,
): Promise<{ friday: DayForecast | null; saturday: DayForecast | null; sunday: DayForecast | null }> {
  const [fri, sat, sun] = await Promise.allSettled([
    getWeatherForDate(friday),
    getWeatherForDate(saturday),
    getWeatherForDate(sunday),
  ]);
  return {
    friday:   fri.status  === "fulfilled" ? fri.value  : null,
    saturday: sat.status  === "fulfilled" ? sat.value  : null,
    sunday:   sun.status  === "fulfilled" ? sun.value  : null,
  };
}

function buildWeatherBlock(
  fri: DayForecast | null,
  sat: DayForecast | null,
  sun: DayForecast | null,
): string | null {
  const lines: string[] = [];
  const fmt = (label: string, d: DayForecast) =>
    `${label}: ${d.condition.emoji} ${d.condition.label}, high ${d.tempMax}°C, ${d.precipProbMax}% chance of rain. ${generateWeatherMessage(d.tempMax, d.precipProbMax, 0, d.placeName)}`;

  if (fri) lines.push(fmt("Friday", fri));
  if (sat) lines.push(fmt("Saturday", sat));
  if (sun) lines.push(fmt("Sunday", sun));

  if (lines.length === 0) return null;
  return "WEEKEND WEATHER FORECAST:\n" + lines.join("\n");
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
  weatherBlock: string | null,
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
    "- Keep the article practical and easy to scan. Focus on what's happening, when, and where. Avoid long introductions or overly descriptive language.",
    "- Length: 200–450 words total.",
    "- Output the article body ONLY — no headline, no byline, no markdown formatting.",
    "",
    "WEATHER RULES (if a forecast is provided):",
    "- Sunny / warm (≥18°C, low rain chance): open with it enthusiastically, encourage people to get out and enjoy the weather.",
    "- Mixed / day-dependent: weave in which day looks better and plan accordingly.",
    "- Wet / cold: acknowledge briefly in the intro but keep the tone positive and highlight any indoor-friendly options.",
    "- Integrate weather naturally into the opening paragraph — do NOT write a separate weather section.",
    "- Do NOT mention specific percentages or degrees in the article — translate them into natural language.",
  ].join("\n");

  const weatherSection = weatherBlock
    ? `\n\nWeather context for your opening (use this to set the tone, not as a separate section):\n${weatherBlock}`
    : "";

  const userPrompt =
    `Write a 'Things to Do in Tallaght This Weekend' article using the following events:\n\n` +
    eventsBlock +
    weatherSection +
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
  const monthName = dublinNow.toLocaleDateString("en-IE", { month: "long" }); // e.g. "April"
  const day = dublinNow.getDate(); // e.g. 4
  const year = dublinNow.getFullYear();
  const title = `Things to Do in Tallaght This Weekend – ${monthName} ${day}, ${year}`;
  const slug = `things-to-do-in-tallaght-this-weekend-${monthName.toLowerCase()}-${day}`;

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

  // Try to fetch weather — fall back silently if unavailable
  let weatherBlock: string | null = null;
  try {
    const w = await fetchWeekendWeather(friday, saturday, sunday);
    weatherBlock = buildWeatherBlock(w.friday, w.saturday, w.sunday);
    if (weatherBlock) {
      logger.info("Weekend roundup: weather forecast included in prompt");
    } else {
      logger.info("Weekend roundup: weather not available — generating without forecast");
    }
  } catch (err) {
    logger.warn({ err }, "Weekend roundup: weather fetch failed — generating without forecast");
  }

  const article = await generateRoundupArticle(events, whatsappNumber, weatherBlock);
  if (!article) return;

  const excerpt = article.body.split(". ").slice(0, 2).join(". ") + ".";

  const [inserted] = await db.insert(postsTable).values({
    title: article.title,
    slug: article.slug,
    body: article.body,
    excerpt,
    status: "held",
    wordCount: article.body.split(/\s+/).length,
    primaryCategoryId: categoryId,
    isFeatured: false,
    publishedAt: null,
  }).returning({ id: postsTable.id });

  // Create an event record pointing to the upcoming Saturday so the weather
  // widget appears on the published article page
  if (inserted?.id) {
    await db.insert(eventsTable).values({
      articleId: inserted.id,
      title: article.title,
      eventDate: saturday,
      status: "upcoming",
    }).catch((err) => logger.warn({ err }, "Weekend roundup: failed to insert event record"));
  }

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
