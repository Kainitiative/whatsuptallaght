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
    const relevant = isRelevantToTallaght(feed.url, title, content);

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
