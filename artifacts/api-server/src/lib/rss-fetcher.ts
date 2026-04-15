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
import { getSettingValue } from "../routes/settings";
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
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

/**
 * Extracts the best available image URL from an RSS item.
 * Priority: media:content → media:thumbnail → <enclosure> → first <img> in content:encoded
 */
function extractFeedImageUrl(item: Record<string, any>): string | null {
  // media:content (most common in WordPress/podcast feeds)
  const mc = item.mediaContent;
  if (mc) {
    const url = mc?.["$"]?.url ?? (Array.isArray(mc) ? mc[0]?.["$"]?.url : null);
    if (url && typeof url === "string") return url;
  }

  // media:thumbnail
  const mt = item.mediaThumbnail;
  if (mt) {
    const url = mt?.["$"]?.url ?? (Array.isArray(mt) ? mt[0]?.["$"]?.url : null);
    if (url && typeof url === "string") return url;
  }

  // <enclosure> tag (podcasts, some news feeds)
  if (item.enclosure?.url && item.enclosure?.type?.startsWith("image/")) {
    return item.enclosure.url;
  }

  // First <img src="..."> in content:encoded HTML
  const html: string = item.contentEncoded || item.content || "";
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const src = imgMatch[1];
    // Skip tracking pixels, icons, and tiny images (common in email templates)
    if (!src.includes("pixel") && !src.includes("tracking") && !src.endsWith(".gif")) {
      return src;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// SDCC news page scraper — scrapes https://www.sdcc.ie/en/news/
// SDCC publish no RSS feed, so we parse the HTML index then fetch each article.
// ---------------------------------------------------------------------------

const SDCC_BASE = "https://www.sdcc.ie";

async function fetchSdccNewsPage(url: string): Promise<NormalisedFeedItem[]> {
  // --- Step 1: Fetch the news index page ---
  const indexRes = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TallaghtCommunityBot/1.0; +https://whatsuptallaght.ie)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!indexRes.ok) throw new Error(`SDCC index fetch failed: ${indexRes.status}`);
  const indexHtml = await indexRes.text();

  // --- Step 2: Extract all unique /en/news/*.html article links ---
  // The page has both featured tiles and card-1 items — grab every news article href.
  const hrefPattern = /href="([^"]*\/en\/news\/[^"]+\.html)"/g;
  const seen = new Set<string>();
  const articleUrls: string[] = [];

  for (const [, href] of indexHtml.matchAll(hrefPattern)) {
    const full = href.startsWith("http") ? href : `${SDCC_BASE}${href}`;
    // Normalise to www.sdcc.ie
    const normalised = full.replace("https://sdcc.ie/", "https://www.sdcc.ie/");
    if (!seen.has(normalised)) {
      seen.add(normalised);
      articleUrls.push(normalised);
    }
  }

  // Extract thumbnail images from card-1-img blocks (best-effort, keyed by href)
  const thumbMap = new Map<string, string>();
  const cardPattern = /href="([^"]+)"[^>]*>[\s\S]{0,200}?<img[^>]+src="([^"]+)"/g;
  for (const [, href, src] of indexHtml.matchAll(cardPattern)) {
    const full = href.startsWith("http") ? href : `${SDCC_BASE}${href}`;
    const normalised = full.replace("https://sdcc.ie/", "https://www.sdcc.ie/");
    const imgFull = src.startsWith("http") ? src : `${SDCC_BASE}${src}`;
    if (!thumbMap.has(normalised)) thumbMap.set(normalised, imgFull);
  }

  logger.info({ url, articleCount: articleUrls.length }, "SDCC: found article links on index page");

  // --- Step 3: Fetch each article page (cap at 12 to be polite) ---
  const items: NormalisedFeedItem[] = [];

  for (const articleUrl of articleUrls.slice(0, 12)) {
    try {
      const artRes = await fetch(articleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TallaghtCommunityBot/1.0; +https://whatsuptallaght.ie)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!artRes.ok) {
        logger.debug({ articleUrl, status: artRes.status }, "SDCC: skipping article (non-200)");
        continue;
      }
      const artHtml = await artRes.text();

      // Title: <h1> inside the content news-doc block
      const h1Match = artHtml.match(/<div[^>]+class="[^"]*content news-doc[^"]*"[^>]*>[\s\S]{0,200}?<h1[^>]*>([^<]+)<\/h1>/);
      const title = h1Match ? h1Match[1].trim() : "";
      if (!title) {
        logger.debug({ articleUrl }, "SDCC: skipping article (no title found)");
        continue;
      }

      // Date: <div class="date">14 Apr 26</div>
      const dateMatch = artHtml.match(/<div[^>]+class="date"[^>]*>([^<]+)<\/div>/);
      let pubDate = new Date();
      if (dateMatch) {
        const parsed = new Date(dateMatch[1].trim());
        if (!isNaN(parsed.getTime())) pubDate = parsed;
      }

      // Body: all <p> tags inside <div class="content news-doc">
      const contentBlockMatch = artHtml.match(/<div[^>]+class="[^"]*content news-doc[^"]*"[^>]*>([\s\S]*?)(?:<script|<div[^>]+class="[^"]*(?:news-nav|footer|related)[^"]*")/);
      let content = "";
      if (contentBlockMatch) {
        const paragraphs = [...contentBlockMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)];
        content = paragraphs
          .map(([, inner]) => inner.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim())
          .filter((p) => p.length > 20) // skip navigation fragments
          .join("\n\n");
      }

      if (!content) {
        logger.debug({ articleUrl, title }, "SDCC: skipping article (no body content extracted)");
        continue;
      }

      // Image: prefer thumbnail from index, fall back to first <img> in article body
      let feedImageUrl: string | null = thumbMap.get(articleUrl) ?? null;
      if (!feedImageUrl) {
        const imgMatch = artHtml.match(/<div[^>]+class="[^"]*content news-doc[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
          const src = imgMatch[1];
          feedImageUrl = src.startsWith("http") ? src : `${SDCC_BASE}${src}`;
        }
      }

      items.push({
        guid: articleUrl,
        title,
        content: `${content}\n\nSource: ${articleUrl}`,
        link: articleUrl,
        feedImageUrl,
        pubDate,
      });
    } catch (err) {
      logger.warn({ err, articleUrl }, "SDCC: failed to fetch individual article (skipping)");
    }
  }

  logger.info({ url, scraped: items.length }, "RSS: SDCC news page scraped");
  return items;
}

// ---------------------------------------------------------------------------
// Eventbrite page scraper — extracts JSON-LD event list from a search page
// ---------------------------------------------------------------------------

interface NormalisedFeedItem {
  guid: string;
  title: string;
  content: string;
  link: string;
  feedImageUrl: string | null;
  pubDate: Date;
}

async function fetchEventbritePage(url: string): Promise<NormalisedFeedItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TallaghtCommunityBot/1.0; +https://whatsuptallaght.ie)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`Eventbrite fetch failed: ${res.status}`);
  const html = await res.text();

  // Extract all JSON-LD blocks
  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const items: NormalisedFeedItem[] = [];

  for (const [, raw] of jsonLdBlocks) {
    let data: any;
    try { data = JSON.parse(raw.trim()); } catch { continue; }

    const events = Array.isArray(data?.itemListElement) ? data.itemListElement : [];
    for (const entry of events) {
      const ev = entry?.item ?? entry;
      const link: string = ev?.url ?? ev?.["@id"] ?? "";
      if (!link) continue;

      const title: string = ev?.name ?? "";
      const description: string = ev?.description ?? "";
      const startDate: string = ev?.startDate ?? "";
      const endDate: string = ev?.endDate ?? "";
      const imageUrl: string | null = typeof ev?.image === "string" ? ev.image : null;

      // Location / venue
      const venueName: string = ev?.location?.name ?? "";
      const venueAddress: string = [
        ev?.location?.address?.streetAddress,
        ev?.location?.address?.addressLocality,
        ev?.location?.address?.addressRegion,
      ].filter(Boolean).join(", ");
      const venueStr = [venueName, venueAddress].filter(Boolean).join(" — ");

      // Organiser
      const organiserName: string = Array.isArray(ev?.organizer)
        ? (ev.organizer[0]?.name ?? "")
        : (ev?.organizer?.name ?? "");

      // Ticket price and booking URL
      const offers = Array.isArray(ev?.offers) ? ev.offers[0] : ev?.offers;
      const price: string = offers?.price
        ? `${offers.priceCurrency ?? "€"}${offers.price}`
        : (offers?.availability?.includes("SoldOut") ? "Sold out" : "");
      const ticketUrl: string = offers?.url ?? link;

      // Format date/time in a human-readable way
      let dateLine = "";
      if (startDate) {
        try {
          const start = new Date(startDate);
          const dateStr = start.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const timeStr = start.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: true });
          let end = "";
          if (endDate) {
            const endDt = new Date(endDate);
            end = ` – ${endDt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
          }
          dateLine = `${dateStr} at ${timeStr}${end}`;
        } catch {
          dateLine = startDate;
        }
      }

      // Build structured content block — every field the AI needs to write a useful article
      const contentParts = [
        dateLine      ? `Date/Time: ${dateLine}`       : "",
        venueStr      ? `Venue: ${venueStr}`            : "",
        organiserName ? `Organiser: ${organiserName}`   : "",
        price         ? `Price: ${price}`               : "",
        ticketUrl     ? `Tickets/More info: ${ticketUrl}` : "",
        description   ? `\n${description}`              : "",
      ];
      const content = contentParts.filter(Boolean).join("\n");

      items.push({
        guid: link,
        title,
        content,
        link,
        feedImageUrl: imageUrl,
        pubDate: startDate ? new Date(startDate) : new Date(),
      });
    }
  }

  logger.info({ url, count: items.length }, "RSS: Eventbrite page scraped");
  return items;
}

// ---------------------------------------------------------------------------
// Fetch and process a single RSS feed
// ---------------------------------------------------------------------------

async function fetchFeed(feed: typeof rssFeedsTable.$inferSelect): Promise<void> {
  logger.info({ feedId: feed.id, name: feed.name, feedType: (feed as any).feedType ?? "rss" }, "RSS: fetching feed");

  // Load admin-configured extra geo keywords once per run (cached in settings table)
  let customGeoKeywords: string[] = [];
  try {
    const raw = await getSettingValue("geo_custom_keywords");
    if (raw) customGeoKeywords = JSON.parse(raw);
  } catch { /* ignore — fall back to built-in keywords only */ }

  const feedType: string = (feed as any).feedType ?? "rss";
  let normalisedItems: NormalisedFeedItem[] = [];

  if (feedType === "eventbrite") {
    try {
      normalisedItems = await fetchEventbritePage(feed.url);
    } catch (err) {
      logger.error({ err, feedId: feed.id, url: feed.url }, "RSS: failed to fetch Eventbrite page");
      await db.update(rssFeedsTable).set({ lastFetchedAt: new Date() }).where(eq(rssFeedsTable.id, feed.id));
      return;
    }
  } else if (feedType === "sdcc") {
    try {
      normalisedItems = await fetchSdccNewsPage(feed.url);
    } catch (err) {
      logger.error({ err, feedId: feed.id, url: feed.url }, "RSS: failed to scrape SDCC news page");
      await db.update(rssFeedsTable).set({ lastFetchedAt: new Date() }).where(eq(rssFeedsTable.id, feed.id));
      return;
    }
  } else {
    let parsed: Awaited<ReturnType<typeof parser.parseURL>>;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      logger.error({ err, feedId: feed.id, url: feed.url }, "RSS: failed to fetch/parse feed");
      await db.update(rssFeedsTable).set({ lastFetchedAt: new Date() }).where(eq(rssFeedsTable.id, feed.id));
      return;
    }

    normalisedItems = (parsed.items ?? []).map((item) => ({
      guid: (item.guid || item.id || item.link) as string,
      title: (item.title ?? "").trim(),
      content: ((item as any).contentEncoded || item.contentSnippet || item.content || item.summary || "").trim(),
      link: item.link ?? "",
      feedImageUrl: extractFeedImageUrl(item as Record<string, any>),
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    })).filter((i) => !!i.guid);
  }

  let newCount = 0;
  let relevantCount = 0;

  for (const item of normalisedItems) {
    const { guid, title, content, link, feedImageUrl, pubDate } = item;
    if (!guid) continue;

    // --- Deduplication ---
    const [existing] = await db
      .select({ id: rssItemsTable.id })
      .from(rssItemsTable)
      .where(eq(rssItemsTable.guid, guid))
      .limit(1);

    if (existing) continue;
    newCount++;

    // --- Geo-filter ---
    const geoRelevant = isRelevantToTallaght(feed.url, title, content, customGeoKeywords);

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
        feedImageUrl: feedImageUrl ?? undefined,
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
