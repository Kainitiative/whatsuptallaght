// ---------------------------------------------------------------------------
// Geo-filter: determine if an RSS item is relevant to Tallaght / South Dublin
// ---------------------------------------------------------------------------

// Feed URLs whose content is always relevant — no keyword check needed.
// Only include feeds that are 100% geographically scoped to South Dublin.
// National feeds (Garda, TFI, Met Éireann) must still pass keyword matching
// because they cover the whole country.
const ALWAYS_RELEVANT_URL_FRAGMENTS = [
  "sdcc.ie",           // South Dublin County Council — every item is about South Dublin
  "shamrockrovers.ie", // Shamrock Rovers FC — home ground is Tallaght Stadium
  "thesquare.ie",      // The Square Shopping Centre — located in Tallaght town centre
];

// Geographic and local keywords — any hit = relevant
const TALLAGHT_KEYWORDS: string[] = [
  // Tallaght itself
  "tallaght",
  "d24",
  // Sub-areas / estates
  "belgard",
  "jobstown",
  "fettercairn",
  "knockmeenagh",
  "kilnamanagh",
  "firhouse",
  "knocklyon",
  "bohernabreena",
  "brittas",
  "saggart",
  "rathcoole",
  "citywest",
  "fortunestown",
  "ballycullen",
  "ballyboden",
  "templeogue",
  // Nearby neighbourhoods that are South Dublin / D24
  "rathfarnham",
  "whitechurch",
  "scholarstown",
  // Council area
  "south dublin",
  "south dublin county",
  "sdcc",
  // Transport
  "luas red line",
  "luas red",
  "belgard luas",
  "tallaght luas",
  // Landmarks / institutions
  "tallaght hospital",
  "tallaght university hospital",
  "the square",
  "the square shopping",
  "tu dublin tallaght",
  "itt dublin",
  "tallaght library",
  "tallaght stadium",
  "naas road",
  "m50",
];

// Trust tiers — used by the AI pipeline to decide auto-publish vs hold
export type FeedTrustLevel = "official" | "news" | "general";

export function getFeedTrustLevel(feedUrl: string): FeedTrustLevel {
  if (
    feedUrl.includes("sdcc.ie") ||
    feedUrl.includes("met.ie") ||
    feedUrl.includes("garda.ie") ||
    feedUrl.includes("transportforireland.ie") ||
    feedUrl.includes("hse.ie")
  ) {
    return "official";
  }
  if (feedUrl.includes("dublinlive.ie") || feedUrl.includes("rte.ie")) {
    return "news";
  }
  return "general";
}

export function isFeedAlwaysRelevant(feedUrl: string): boolean {
  return ALWAYS_RELEVANT_URL_FRAGMENTS.some((fragment) => feedUrl.includes(fragment));
}

export function hasKeywordMatch(title: string, content: string, extraKeywords: string[] = []): boolean {
  const combined = `${title} ${content}`.toLowerCase();
  const allKeywords = extraKeywords.length > 0 ? [...TALLAGHT_KEYWORDS, ...extraKeywords] : TALLAGHT_KEYWORDS;
  return allKeywords.some((kw) => combined.includes(kw.toLowerCase()));
}

export function isRelevantToTallaght(feedUrl: string, title: string, content: string, extraKeywords: string[] = []): boolean {
  if (isFeedAlwaysRelevant(feedUrl)) return true;
  return hasKeywordMatch(title, content, extraKeywords);
}
