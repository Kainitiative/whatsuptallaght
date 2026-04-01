import { db } from "@workspace/db";
import { rssFeedsTable } from "@workspace/db/schema";

const DEFAULT_FEEDS: Omit<typeof rssFeedsTable.$inferInsert, "id" | "createdAt">[] = [

  // ── Local Government ─────────────────────────────────────────────────────────
  {
    name: "South Dublin County Council — News",
    url: "https://www.sdcc.ie/en/news/news.rss",
    isActive: true,
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
    url: "https://www.garda.ie/en/press-centre/press-releases/press-releases.rss",
    isActive: true,
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
    name: "Transport for Ireland — Service Alerts",
    url: "https://www.transportforireland.ie/tfi-alerts/feed/",
    isActive: true,
    checkIntervalMinutes: 15,
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
    url: "https://www.met.ie/Open_Data/rss/met-eireann-weather-warnings-rss.xml",
    isActive: true,
    checkIntervalMinutes: 30,
  },

  // ── National News (Dublin / Community Focus) ─────────────────────────────────
  {
    name: "RTÉ News — Ireland",
    url: "https://www.rte.ie/news/rss/news-ireland.xml",
    isActive: false,
    checkIntervalMinutes: 60,
  },
  {
    name: "Dublin Live — Latest News",
    url: "https://www.dublinlive.ie/news/dublin-news/?service=rss",
    isActive: true,
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

export async function seedRssFeeds(): Promise<void> {
  for (const feed of DEFAULT_FEEDS) {
    await db
      .insert(rssFeedsTable)
      .values(feed)
      .onConflictDoUpdate({
        target: rssFeedsTable.url,
        set: {
          name: feed.name,
          checkIntervalMinutes: feed.checkIntervalMinutes,
        },
      });
  }
}
