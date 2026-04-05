import { db } from "@workspace/db";
import { rssFeedsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_FEEDS: Omit<typeof rssFeedsTable.$inferInsert, "id" | "createdAt">[] = [

  // ── Local Government ─────────────────────────────────────────────────────────
  {
    name: "South Dublin County Council — News",
    // SDCC removed their RSS feed — disabled until a working URL is found
    url: "https://www.sdcc.ie/en/news/news.rss",
    isActive: false,
    checkIntervalMinutes: 60,
  },
  {
    name: "Dublin City Council — News",
    url: "https://www.dublincity.ie/rss/news.xml",
    isActive: false,
    checkIntervalMinutes: 120,
  },

  // ── Emergency Services ───────────────────────────────────────────────────────
  {
    name: "An Garda Síochána — Press Releases",
    // Garda blocks cloud IP ranges; re-enable when self-hosting on VPS
    url: "https://www.garda.ie/en/press-centre/press-releases/press-releases.rss",
    isActive: false,
    checkIntervalMinutes: 30,
  },
  {
    name: "Dublin Fire Brigade — News",
    url: "https://www.dublincity.ie/rss/fire-brigade-news.xml",
    isActive: false,
    checkIntervalMinutes: 60,
  },

  // ── Transport ────────────────────────────────────────────────────────────────
  {
    name: "Transport for Ireland — News",
    // Correct URL confirmed 2026-04: /tfi-alerts/feed/ redirects to 404; /feed/ works
    url: "https://www.transportforireland.ie/feed/",
    isActive: false,
    checkIntervalMinutes: 20,
  },
  {
    name: "Dublin Bus — News & Disruptions",
    url: "https://www.dublinbus.ie/rss",
    isActive: false,
    checkIntervalMinutes: 30,
  },

  // ── Weather ──────────────────────────────────────────────────────────────────
  {
    name: "Met Éireann — Weather Warnings",
    // Met Éireann removed RSS support — disabled
    url: "https://www.met.ie/Open_Data/rss/met-eireann-weather-warnings-rss.xml",
    isActive: false,
    checkIntervalMinutes: 30,
  },

  // ── National News (Dublin / Community Focus) ─────────────────────────────────
  {
    name: "The Journal — Ireland News",
    // Replaces RTÉ RSS (broken); thejournal.ie has working RSS and good Tallaght coverage
    url: "https://www.thejournal.ie/feed/",
    isActive: false,
    checkIntervalMinutes: 30,
  },
  {
    name: "RTÉ News — Ireland",
    url: "https://www.rte.ie/news/rss/news-ireland.xml",
    isActive: false,
    checkIntervalMinutes: 60,
  },
  {
    name: "Dublin Live — Latest News",
    url: "https://www.dublinlive.ie/news/dublin-news/?service=rss",
    isActive: false,
    checkIntervalMinutes: 30,
  },

  // ── Health ───────────────────────────────────────────────────────────────────
  {
    name: "HSE — News",
    url: "https://www.hse.ie/eng/services/news/news.rss",
    isActive: false,
    checkIntervalMinutes: 120,
  },

  // ── Sport ────────────────────────────────────────────────────────────────────
  {
    name: "FAI — Football News",
    url: "https://www.fai.ie/rss",
    isActive: false,
    checkIntervalMinutes: 120,
  },

  // ── Government ───────────────────────────────────────────────────────────────
  {
    name: "Citizens Information — News",
    url: "https://www.citizensinformation.ie/en/rss",
    isActive: false,
    checkIntervalMinutes: 240,
  },
  {
    name: "Department of Social Protection — News",
    url: "https://www.gov.ie/en/feed/?category=social-protection",
    isActive: false,
    checkIntervalMinutes: 240,
  },
];

// URLs that have changed or been removed — disable them if they exist in the DB
const DEPRECATED_URLS: string[] = [
  "https://www.transportforireland.ie/tfi-alerts/feed/", // Changed to /feed/
  "https://www.rte.ie/news/rss/news-ireland.xml",        // Replaced by thejournal.ie
];

export async function seedRssFeeds(): Promise<void> {
  for (const feed of DEFAULT_FEEDS) {
    await db
      .insert(rssFeedsTable)
      .values(feed)
      .onConflictDoUpdate({
        target: rssFeedsTable.url,
        set: {
          name: feed.name,
          isActive: feed.isActive,
          checkIntervalMinutes: feed.checkIntervalMinutes,
        },
      });
  }

  // Deactivate any deprecated feed URLs
  for (const url of DEPRECATED_URLS) {
    await db
      .update(rssFeedsTable)
      .set({ isActive: false })
      .where(eq(rssFeedsTable.url, url));
  }
}
