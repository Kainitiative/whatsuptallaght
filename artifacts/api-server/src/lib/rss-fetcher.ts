import Parser from "rss-parser";
import { db } from "@workspace/db";
import {
  rssFeedsTable,
  rssItemsTable,
  submissionsTable,
  jobQueueTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isRelevantToTallaght, getFeedTrustLevel } from "./geo-filter";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Events-only filter — returns true if content describes a real upcoming event
// with a specific date/time reference. Uses pure regex — zero AI cost.
// ---------------------------------------------------------------------------

const DATE_SIGNALS = [
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i,
  /\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /\b(at|from)\s+\d{1,2}(:\d{2})?\s*(am|pm)/i,
  /\b\d{1,2}(am|pm)\b/i,
  /\b(today|tonight|tomorrow)\b/i,
  /\bthis\s+(weekend|week|saturday|sunday|friday|evening|morning)\b/i,
  /\bnext\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bcoming\s+(soon|up|this)\b/i,
  /\bfrom\s+\d{1,2}[:.]\d{2}\b/i,
  /\bdoors\s+open\b/i,
  /\btaking\s+place\b/i,
];

const EVENT_SIGNALS = [
  /\b(event|events|festival|gig|concert|show|exhibition|market|fair|launch|opening|sale|workshop|class|competition|ceremony|performance|screening|celebration|party|seminar|webinar|live)\b/i,
  /\b(kids?\s+event|fun\s+day|open\s+day|pop[- ]up|come\s+along|join\s+us|don't\s+miss|book\s+now|get\s+your\s+tickets|limited\s+spaces|free\s+entry|on\s+the\s+night|happening)\b/i,
];

function isEventContent(title: string, content: string): boolean {
  const text = `${title} ${content}`;
  const hasDate = DATE_SIGNALS.some((rx) => rx.test(text));
  const hasEvent = EVENT_SIGNALS.some((rx) => rx.test(text));
  return hasDate && hasEvent;
}

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "TallaghtCommunityPlatform/1.0 (+https://tallaght.community)" },
  customFields: {
    item: [["media:content", "mediaContent"], ["content:encoded", "contentEncoded"]],
  },
});

// ---------------------------------------------------------------------------
// Fetch and process a single RSS feed
// ---------------------------------------------------------------------------

async function fetchFeed(feed: typeof rssFeedsTable.$inferSelect): Promise<void> {
  logger.info({ feedId: feed.id, name: feed.name }, "RSS: fetching feed");

  let parsed: Awaited<ReturnType<typeof parser.parseURL>>;

  try {
    parsed = await parser.parseURL(feed.url);
  } catch (err) {
    logger.error({ err, feedId: feed.id, url: feed.url }, "RSS: failed to fetch/parse feed");
    // Update timestamp so we don't hammer a broken feed every 5 minutes
    await db
      .update(rssFeedsTable)
      .set({ lastFetchedAt: new Date() })
      .where(eq(rssFeedsTable.id, feed.id));
    return;
  }

  let newCount = 0;
  let relevantCount = 0;

  for (const item of parsed.items ?? []) {
    // Need at least a GUID or link to deduplicate
    const guid = item.guid || item.id || item.link;
    if (!guid) continue;

    const title = (item.title ?? "").trim();
    const content = (
      (item as any).contentEncoded ||
      item.contentSnippet ||
      item.content ||
      item.summary ||
      ""
    ).trim();
    const link = item.link ?? "";
    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

    // --- Deduplication ---
    const [existing] = await db
      .select({ id: rssItemsTable.id })
      .from(rssItemsTable)
      .where(eq(rssItemsTable.guid, guid))
      .limit(1);

    if (existing) continue;
    newCount++;

    // --- Geo-filter ---
    const geoRelevant = isRelevantToTallaght(feed.url, title, content);

    // --- Events-only filter (per-feed opt-in) ---
    const eventsOnly = (feed as any).filterMode === "events_only";
    const relevant = geoRelevant && (!eventsOnly || isEventContent(title, content));

    if (eventsOnly && geoRelevant && !relevant) {
      logger.debug({ title, feedName: feed.name }, "RSS: skipping — events-only filter: no date+event signal found");
    }

    // Store every new item (relevant or not) for analytics / future tuning
    const [rssItem] = await db
      .insert(rssItemsTable)
      .values({
        feedId: feed.id,
        guid,
        title,
        link,
        content,
        publishedAt: pubDate,
        isRelevant: relevant,
      })
      .onConflictDoNothing()
      .returning();

    if (!rssItem || !relevant) continue;
    relevantCount++;

    // --- Create a submission record ---
    const fullText = [title, link ? `Source: ${link}` : null, content]
      .filter(Boolean)
      .join("\n\n");

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        source: "rss",
        rawText: fullText,
        rssItemId: rssItem.id,
        status: "pending",
      })
      .returning();

    // --- Queue AI processing ---
    const trustLevel = getFeedTrustLevel(feed.url);

    await db.insert(jobQueueTable).values({
      jobType: "PROCESS_RSS_SUBMISSION",
      payload: {
        submissionId: submission.id,
        rssItemId: rssItem.id,
        feedId: feed.id,
        feedName: feed.name,
        feedUrl: feed.url,
        trustLevel,
        title,
        content,
        link,
      },
      status: "pending",
      maxAttempts: 2,
    });

    logger.info(
      { submissionId: submission.id, rssItemId: rssItem.id, feedName: feed.name, title },
      "RSS: relevant item queued",
    );
  }

  // Update lastFetchedAt
  await db
    .update(rssFeedsTable)
    .set({ lastFetchedAt: new Date() })
    .where(eq(rssFeedsTable.id, feed.id));

  if (newCount > 0) {
    logger.info(
      { feedId: feed.id, name: feed.name, newCount, relevantCount },
      "RSS: feed processed",
    );
  }
}

// ---------------------------------------------------------------------------
// Run ingestion for all feeds that are due
// ---------------------------------------------------------------------------

export async function runRssIngestion(): Promise<void> {
  const now = new Date();

  const feeds = await db
    .select()
    .from(rssFeedsTable)
    .where(eq(rssFeedsTable.isActive, true));

  const dueFeeds = feeds.filter((feed) => {
    if (!feed.lastFetchedAt) return true; // Never fetched — fetch now
    const nextFetch = new Date(
      feed.lastFetchedAt.getTime() + feed.checkIntervalMinutes * 60 * 1000,
    );
    return now >= nextFetch;
  });

  if (dueFeeds.length === 0) return;

  logger.info({ count: dueFeeds.length }, "RSS: processing due feeds");

  for (const feed of dueFeeds) {
    await fetchFeed(feed).catch((err) =>
      logger.error({ err, feedId: feed.id }, "RSS: unhandled error processing feed"),
    );
  }
}

// ---------------------------------------------------------------------------
// Scheduler — polls every 5 minutes, respects per-feed checkIntervalMinutes
// ---------------------------------------------------------------------------

export function startRssScheduler(): void {
  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  logger.info("RSS scheduler started");

  // Run immediately on boot to pick up missed items
  runRssIngestion().catch((err) =>
    logger.error({ err }, "RSS: initial ingestion run failed"),
  );

  setInterval(() => {
    runRssIngestion().catch((err) =>
      logger.error({ err }, "RSS: scheduled ingestion run failed"),
    );
  }, POLL_INTERVAL_MS);
}
