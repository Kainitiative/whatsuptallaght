import Parser from "rss-parser";
import { db } from "@workspace/db";
import {
  rssFeedsTable,
  rssItemsTable,
  submissionsTable,
  jobQueueTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getFeedTrustLevel } from "./geo-filter";
import { logger } from "./logger";
import { getSettingValue } from "../routes/settings";

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
// Shared item type
// ---------------------------------------------------------------------------

interface NormalisedFeedItem {
  guid: string;
  title: string;
  content: string;
  link: string;
  feedImageUrl: string | null;
  pubDate: Date;
}

// ---------------------------------------------------------------------------
// Ticketmaster Discovery API client
// Replaces the Eventbrite integration — Eventbrite blocked all server-side
// access (WAF CAPTCHA on RSS, deprecated search API endpoint).
// Ticketmaster Discovery API is free up to 5,000 calls/day with no bot blocking.
//
// Feed URL format stored in DB:
//   https://app.ticketmaster.com/discovery/v2/events.json?keyword=tallaght&countryCode=IE
// The apikey param is added at runtime from platform_settings.
// ---------------------------------------------------------------------------

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements: number };
}

interface TmEvent {
  id?: string;
  name?: string;
  url?: string;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    end?: { localDate?: string; localTime?: string };
  };
  images?: { url?: string; width?: number; height?: number; ratio?: string }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
    }[];
  };
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  info?: string;
  pleaseNote?: string;
}

function buildTicketmasterContent(ev: TmEvent): NormalisedFeedItem {
  const link = ev.url ?? "";
  const title = ev.name ?? "";

  const startLocal = ev.dates?.start?.localDate;
  const startTime = ev.dates?.start?.localTime;
  let dateLine = "";
  if (startLocal) {
    try {
      const dt = new Date(`${startLocal}T${startTime ?? "00:00:00"}`);
      const dateStr = dt.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = startTime ? dt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
      dateLine = timeStr ? `${dateStr} at ${timeStr}` : dateStr;
    } catch {
      dateLine = startLocal;
    }
  }

  const venue = ev._embedded?.venues?.[0];
  const venueName = venue?.name ?? "";
  const venueCity = venue?.city?.name ?? "";
  const venueAddr = venue?.address?.line1 ?? "";
  const venueStr = [venueName, venueAddr, venueCity].filter(Boolean).join(", ");

  const price = ev.priceRanges?.[0];
  const priceStr = price
    ? `${price.currency ?? "EUR"} ${price.min ?? ""}${price.max && price.max !== price.min ? `–${price.max}` : ""}`
    : "";

  const genre = ev.classifications?.[0]?.genre?.name ?? ev.classifications?.[0]?.segment?.name ?? "";
  const notes = [ev.info, ev.pleaseNote].filter(Boolean).join(" ");

  const parts = [
    dateLine   ? `Date/Time: ${dateLine}`   : "",
    venueStr   ? `Venue: ${venueStr}`       : "",
    priceStr   ? `Price: ${priceStr}`       : "",
    genre      ? `Category: ${genre}`       : "",
    link       ? `Tickets/More info: ${link}` : "",
    notes      ? `\n${notes}`              : "",
  ].filter(Boolean);

  // Best image: prefer 16_9 ratio at largest size
  const bestImg = (ev.images ?? [])
    .filter((i) => i.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
    .find((i) => i.ratio === "16_9") ?? ev.images?.[0];

  const pubDate = startLocal
    ? new Date(`${startLocal}T${startTime ?? "00:00:00"}`)
    : new Date();

  return {
    guid: `ticketmaster-${ev.id ?? link}`,
    title,
    content: parts.join("\n"),
    link,
    feedImageUrl: bestImg?.url ?? null,
    pubDate,
  };
}

async function fetchTicketmasterEvents(feedUrl: string, apiKey: string): Promise<NormalisedFeedItem[]> {
  const base = new URL(feedUrl);
  base.searchParams.set("apikey", apiKey);
  base.searchParams.set("size", "50");
  base.searchParams.set("sort", "date,asc");
  base.searchParams.set("startDateTime", new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));

  const res = await fetch(base.toString(), {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ticketmaster API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as TmResponse;
  const events = data._embedded?.events ?? [];
  const items = events
    .filter((ev) => ev.url && ev.name)
    .map(buildTicketmasterContent);

  logger.info({ feedUrl, count: items.length }, "RSS: Ticketmaster events fetched");
  return items;
}

function buildEventContent(ev: EventbriteEvent): { title: string; content: string; link: string; feedImageUrl: string | null; pubDate: Date; guid: string } {
  const link = ev.url ?? "";
  const title = ev.name?.text ?? "";
  const description = ev.description?.text ?? ev.summary ?? "";
  const startDate = ev.start?.local ?? ev.start?.utc ?? "";
  const endDate = ev.end?.local ?? ev.end?.utc ?? "";
  const imageUrl = ev.logo?.url ?? null;

  const venueName = ev.venue?.name ?? "";
  const venueAddress = [
    ev.venue?.address?.address_1,
    ev.venue?.address?.city,
  ].filter(Boolean).join(", ");
  const venueStr = [venueName, venueAddress].filter(Boolean).join(" — ");

  const organiserName = ev.organizer?.name ?? "";
  const price = ev.is_free ? "Free" : "";
  const ticketUrl = link;

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

  const contentParts = [
    dateLine      ? `Date/Time: ${dateLine}`         : "",
    venueStr      ? `Venue: ${venueStr}`              : "",
    organiserName ? `Organiser: ${organiserName}`     : "",
    price         ? `Price: ${price}`                 : "",
    ticketUrl     ? `Tickets/More info: ${ticketUrl}` : "",
    description   ? `\n${description}`               : "",
  ];

  return {
    guid: ev.id ? `eventbrite-${ev.id}` : link,
    title,
    content: contentParts.filter(Boolean).join("\n"),
    link,
    feedImageUrl: imageUrl,
    pubDate: startDate ? new Date(startDate) : new Date(),
  };
}

async function fetchEventbriteApi(feedUrl: string, apiKey: string): Promise<NormalisedFeedItem[]> {
  // Extract the search term from the Eventbrite browse URL
  // e.g. /d/ireland--dublin/tallaght/ → "tallaght"
  const slugMatch = feedUrl.match(/\/d\/[^/]+\/([^/?#]+)\/?/);
  const searchSlug = slugMatch?.[1] ?? "";
  const searchTerm = searchSlug.replace(/-+/g, " ").trim();

  if (!searchTerm) throw new Error(`Could not extract search term from Eventbrite URL: ${feedUrl}`);

  const params = new URLSearchParams({
    q: searchTerm,
    "location.address": "Dublin, Ireland",
    "location.within": "20km",
    "time_filter": "current_future",
    "sort_by": "date",
    "expand": "venue,organizer",
    "page_size": "50",
  });

  const res = await fetch(`https://www.eventbriteapi.com/v3/events/search/?${params}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Eventbrite API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as EventbriteApiResponse;
  const items: NormalisedFeedItem[] = [];

  for (const ev of data.events ?? []) {
    if (!ev.url) continue;
    items.push(buildEventContent(ev));
  }

  logger.info({ feedUrl, searchTerm, count: items.length }, "RSS: Eventbrite API fetched");
  return items;
}

// ---------------------------------------------------------------------------
// Fetch and process a single RSS feed
// ---------------------------------------------------------------------------

async function fetchFeed(feed: typeof rssFeedsTable.$inferSelect): Promise<void> {
  logger.info({ feedId: feed.id, name: feed.name, feedType: (feed as any).feedType ?? "rss" }, "RSS: fetching feed");

  const feedType: string = (feed as any).feedType ?? "rss";
  let normalisedItems: NormalisedFeedItem[] = [];

  if (feedType === "ticketmaster" || feedType === "eventbrite") {
    // Eventbrite is fully blocked (WAF CAPTCHA on RSS, deprecated API search endpoint).
    // All event feeds now route through the Ticketmaster Discovery API.
    // Feeds with type "eventbrite" are automatically migrated to use Ticketmaster.
    let apiKey: string | null = null;
    try {
      apiKey = await getSettingValue("ticketmaster_api_key");
    } catch (keyErr) {
      logger.warn({ keyErr, feedId: feed.id }, "RSS: Ticketmaster feed skipped — could not read API key (decryption error)");
      await db.update(rssFeedsTable).set({ lastFetchedAt: new Date() }).where(eq(rssFeedsTable.id, feed.id));
      return;
    }
    if (!apiKey) {
      logger.warn({ feedId: feed.id, url: feed.url }, "RSS: Ticketmaster feed skipped — no ticketmaster_api_key in Settings. Get a free key at developer.ticketmaster.com");
      await db.update(rssFeedsTable).set({ lastFetchedAt: new Date() }).where(eq(rssFeedsTable.id, feed.id));
      return;
    }
    try {
      normalisedItems = await fetchTicketmasterEvents(feed.url, apiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 401 = key not yet active or invalid. Back off for 60 min to avoid log spam.
      const backoffMinutes = msg.includes("401") ? 60 : 15;
      const backoffTs = new Date(Date.now() - (feed.checkIntervalMinutes - backoffMinutes) * 60 * 1000);
      if (msg.includes("401")) {
        logger.warn({ feedId: feed.id }, `RSS: Ticketmaster API key rejected (401) — key not yet activated or invalid. Backing off ${backoffMinutes} min. Check developer.ticketmaster.com`);
      } else {
        logger.error({ err, feedId: feed.id, url: feed.url }, "RSS: Ticketmaster fetch failed");
      }
      await db.update(rssFeedsTable).set({ lastFetchedAt: backoffTs }).where(eq(rssFeedsTable.id, feed.id));
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

    // --- Keyword filter (per-feed, optional) ---
    const keywordFilters: string[] | null | undefined = (feed as any).keywordFilters;
    const hasKeywords = Array.isArray(keywordFilters) && keywordFilters.length > 0;
    const keywordMatch = !hasKeywords || (() => {
      const combined = `${title} ${content}`.toLowerCase();
      return keywordFilters!.some((kw) => combined.includes(kw.toLowerCase()));
    })();

    // --- Events-only filter (per-feed opt-in) ---
    const eventsOnly = (feed as any).filterMode === "events_only";
    const relevant = keywordMatch && (!eventsOnly || isEventContent(title, content));

    if (!keywordMatch) {
      logger.debug({ title, feedName: feed.name }, "RSS: skipping — no keyword match");
    } else if (eventsOnly && !relevant) {
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
