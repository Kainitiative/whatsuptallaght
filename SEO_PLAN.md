# What's Up Tallaght — SEO Improvement Plan

_Research compiled April 2026. Based on Google Search Console data, site audit, and top Tallaght search queries._

---

## Current State Audit

### What the site already has
- Sitemap at `/sitemap.xml` — covers homepage, `/about`, all `/category/:slug` pages, and all published articles
- Five pillar pages already built: `/events`, `/tallaght-news`, `/tallaght-community`, `/whats-on-tallaght`, `/search`
- 41 published articles (as of April 2026)
- RSS feeds pulling in SDCC, Shamrock Rovers, council content daily

### What's broken or missing

| Issue | Severity | Notes |
|-------|----------|-------|
| Every page has the same `<title>` and `<meta description>` | 🔴 Critical | SPA static `index.html` — Google sees "Tallaght Community — Local News & Stories" for every article |
| No per-article `og:image`, `og:title`, `og:description` | 🔴 Critical | Social shares show generic site image regardless of article |
| No JSON-LD structured data (Article schema) | 🟠 High | Google can't classify articles as news content |
| Pillar pages missing from sitemap | 🟠 High | `/events`, `/tallaght-news`, `/tallaght-community`, `/whats-on-tallaght` not in sitemap |
| robots.txt has no `Sitemap:` directive | 🟠 High | Currently the Cloudflare boilerplate, not a real robots.txt |
| AI headlines capped at 12 words, no venue/date instruction | 🟠 High | "OM Chanting Session in Tallaght…" vs "OM Chanting at Brookfield Community Centre, Tallaght – April 2026" |
| Article bodies don't use full venue names consistently | 🟡 Medium | "the library" instead of "Tallaght Library"; "the stadium" instead of "Tallaght Stadium" |
| No internal linking between articles | 🟡 Medium | Related articles section exists visually but not woven into the body text Google crawls |
| Thin content on many articles | 🟡 Medium | Known limitation — cannot invent facts from WhatsApp submissions |

---

## Top Search Opportunities (from query data, April 2026)

| Query | Search Interest | Trend | WUT Opportunity |
|-------|----------------|-------|-----------------|
| tallaght stadium | 64 | +250% 🔥 | Any Shamrock Rovers or event at stadium |
| tallaght library | 20 | +100% 🔥 | Library events already coming via RSS |
| leisureplex tallaght | 5 | +110% | Events/classes at Leisureplex |
| part time jobs tallaght | 5 | +120% | Jobs/recruitment announcements |
| imc tallaght | 5 | +130% | Cinema listings/events |
| old mill tallaght | 7 | +200% | Local business/events news |
| homesavers tallaght | 6 | +250% | Any stories about The Square shops |
| specsavers tallaght | 12 | +250% | Health/optician stories |
| civic theatre tallaght | 7 | -30% (opportunity) | Theatre listings |
| tallaght sports complex | 6 | +100% | Sports facility events |

These are "money keywords" — the site can rank for these if articles explicitly include the full venue/place name in the title and first paragraph.

---

## Fix 1 — Per-Page Dynamic Meta Tags (Biggest Impact)

**Problem:** Every page has `<title>Tallaght Community — Local News & Stories</title>` because the site is a React SPA with a single static `index.html`. Google does render JavaScript, but the delay means many pages aren't being indexed with the right title.

**Solution:** Add `react-helmet-async` to the community website.

```
npm install react-helmet-async
```

**App.tsx** — wrap in `<HelmetProvider>`:
```tsx
import { HelmetProvider } from 'react-helmet-async';
// wrap <App> content in <HelmetProvider>
```

**article.tsx** — add inside the component:
```tsx
import { Helmet } from 'react-helmet-async';

<Helmet>
  <title>{post.title} | What's Up Tallaght</title>
  <meta name="description" content={post.excerpt ?? post.body.slice(0, 160)} />
  <link rel="canonical" href={`https://whatsuptallaght.ie/article/${post.slug}`} />
  <meta property="og:title" content={post.title} />
  <meta property="og:description" content={post.excerpt ?? post.body.slice(0, 160)} />
  <meta property="og:image" content={post.headerImageUrl ?? 'https://whatsuptallaght.ie/images/tallaght-news.png'} />
  <meta property="og:url" content={`https://whatsuptallaght.ie/article/${post.slug}`} />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={post.title} />
  <meta name="twitter:description" content={post.excerpt ?? post.body.slice(0, 160)} />
  <meta name="twitter:image" content={post.headerImageUrl ?? 'https://whatsuptallaght.ie/images/tallaght-news.png'} />
  <script type="application/ld+json">{JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": post.title,
    "image": post.headerImageUrl ? [post.headerImageUrl] : [],
    "datePublished": post.publishedAt,
    "dateModified": post.updatedAt ?? post.publishedAt,
    "author": { "@type": "Organization", "name": "What's Up Tallaght" },
    "publisher": {
      "@type": "Organization",
      "name": "What's Up Tallaght",
      "logo": { "@type": "ImageObject", "url": "https://whatsuptallaght.ie/images/wut-logo.png" }
    },
    "description": post.excerpt ?? post.body.slice(0, 160),
    "url": `https://whatsuptallaght.ie/article/${post.slug}`
  })}</script>
</Helmet>
```

**Pillar pages** — each gets a hand-crafted Helmet block. Suggested titles/descriptions:

| Page | Title | Description |
|------|-------|-------------|
| `/events` | `Events in Tallaght 2026 \| What's On Tallaght` | What's on in Tallaght this week — free events, community activities, sports fixtures and more. |
| `/tallaght-news` | `Tallaght News Today \| Local Stories & Updates` | The latest news from Tallaght, Dublin — submitted by residents, published daily. |
| `/tallaght-community` | `Tallaght Community \| Local Updates & Stories` | Community news, notices, and local stories from across Tallaght and South Dublin. |
| `/whats-on-tallaght` | `What's On in Tallaght \| Weekly Guide` | Your weekly guide to things to do in Tallaght — events, sport, family activities and more. |
| `/search` | `Search Tallaght News \| What's Up Tallaght` | Search local news, events and community stories from Tallaght, Dublin. |
| `/category/events` | `Tallaght Events \| What's On Near You` | All events in Tallaght — community gatherings, sport fixtures, workshops and activities. |
| `/category/sport` | `Tallaght Sport News \| Local Matches & Results` | Sport news from Tallaght — Shamrock Rovers, GAA, local clubs and more. |

---

## Fix 2 — Sitemap + robots.txt

**robots.txt** (replace current Cloudflare boilerplate):
```
User-agent: *
Allow: /

Sitemap: https://whatsuptallaght.ie/sitemap.xml
```

**sitemap.ts** — add pillar pages to the `staticPages` array:
```typescript
const staticPages = [
  urlEntry(`${BASE_URL}/`, today, "daily", "1.0"),
  urlEntry(`${BASE_URL}/events`, today, "daily", "0.9"),
  urlEntry(`${BASE_URL}/whats-on-tallaght`, today, "daily", "0.9"),
  urlEntry(`${BASE_URL}/tallaght-news`, today, "daily", "0.9"),
  urlEntry(`${BASE_URL}/tallaght-community`, today, "weekly", "0.8"),
  urlEntry(`${BASE_URL}/search`, today, "monthly", "0.6"),
  urlEntry(`${BASE_URL}/about`, today, "monthly", "0.5"),
];
```

When AI-generated place pillar pages are built (see Fix 7 below), each live pillar page also gets an entry at `priority 0.9` and `changefreq weekly`.

---

## Fix 3 — SEO-Optimised Headline Generation (AI Pipeline)

**Current instruction** in `extractInfo` (line 332 of `ai-pipeline.ts`):
```
"headline": "Suggested article headline (max 12 words, factual, no clickbait)",
```

**Replacement:**
```
"headline": "Article headline for search. Up to 16 words. Must include the specific venue or place name if mentioned (e.g. 'Tallaght Library', 'Tallaght Stadium', 'Civic Theatre Tallaght' — not just 'the library'). For events, include month and year (e.g. 'Free Kids Workshop at Tallaght Library – April 2026'). Write how someone would search, not how a journalist would write a headline. Factual only — no invented details.",
```

**Examples of the before/after transformation:**

| Before | After |
|--------|-------|
| OM Chanting Session in Tallaght… | OM Chanting at Brookfield Community Centre, Tallaght – April 2026 |
| Free Teen Kickboxing Starting in November | Free Teen Kickboxing at Tallaght Sports Complex – November 2026 |
| STEAM Event at Local Library | STEAM Saturday Engineering Workshop at Tallaght Library – Free for Kids |
| Shamrock Rovers Prepare for Derby | Shamrock Rovers vs Bohemians at Tallaght Stadium – League of Ireland April 2026 |
| Job Opportunity in South Dublin | Part-Time Jobs Available in Tallaght – Apply at The Square |

---

## Fix 4 — Venue Names in Article Body (AI Pipeline)

Add to the `writeArticle` system prompt (after the existing rule 3):

```
6. VENUE AND PLACE NAMES — always use the full specific name on first mention:
   - "Tallaght Library" not "the library"
   - "Tallaght Stadium" not "the ground" or "the stadium"
   - "The Square, Tallaght" not "the shopping centre"
   - "Civic Theatre, Tallaght" not "the theatre"
   - "Brookfield Community Centre" not "the centre"
   - Only use the full name if it is mentioned in the submission. Do not add place names that aren't there.
```

This ensures venue-name keywords appear in the article text Google crawls, not just in the title.

---

## Fix 5 — Internal Linking

**What exists:** Related Articles section at the bottom of each article page. This provides some link equity but the links are in a rendered-JS section and not within the main article body text.

**Better approach (future work):** After `writeArticle` runs in the AI pipeline, look up 1-2 recent published articles in the same category, and append a plain-text "Related:" block to the article body:

```
Related: [Article Title](https://whatsuptallaght.ie/article/slug)
```

This would put internal links inside the indexed body text. Implementation requires:
- DB lookup of 2 recent same-category posts (by `primaryCategoryId`) during pipeline
- Append to `articleBody` before `postsTable.insert`
- Requires care not to link to the current article (race condition — article not yet published)

Once place pillar pages (Fix 7) exist, articles should also link to their relevant pillar page. See Fix 7 for details.

---

## Fix 6 — Thin Content

**The honest constraint:** The platform publishes exactly what community members submit via WhatsApp. The AI must not invent facts. This means some articles will always be short (80–120 word notices).

**What can be done without inventing facts:**
- For event articles, the AI is already instructed to cover "what, where, when, who" — ensuring the maximum extraction from the submission
- The web search entity research (already implemented) adds visual context to DALL-E but could theoretically also add a factual description of the venue (e.g. "Tallaght Library is located in the Civic Centre, Tallaght") as a background sentence, sourced from the web. This would only apply if the venue is well-known and the description is publicly verifiable.
- A future option: after publishing, generate a "did you know" factual sidebar block about the venue using web search

**What NOT to do:** Do not pad articles with invented context, background filler, or "organisation X is committed to Y" language. This violates editorial policy and reduces trust.

---

## Fix 7 — Entity Pillar Pages (Admin-Driven, Dual Purpose)

### Concept

Pillar pages cover any significant Tallaght entity: a place, a business, a sports club, a community organisation, a hospital. The system is dual-purpose:

**Purpose 1 — SEO.** A permanent, content-rich page that ranks for the entity's name. People search "shamrock rovers", "tallaght stadium", "tallaght hospital" — not generic news. A pillar page owns that search result and pulls all related articles into one hub that grows in authority over time.

**Purpose 2 — AI Knowledge Base.** Every pillar page is also a curated fact file the AI pipeline reads from when it processes a matching article. Instead of guessing or running a live web search, the pipeline looks up the entity's page and uses the admin-provided knowledge directly. This means:
- Accurate, consistent DALL-E image prompts (using the real kit colours, crest description, ground surface stored by admin — not a web search that might be wrong or outdated)
- Richer article bodies (factual context about the entity injected naturally)
- Zero extra API cost for known entities (DB lookup replaces web search)
- The more pillar pages exist, the smarter every future article becomes

**Example: Shamrock Rovers**

Admin creates a Shamrock Rovers pillar page and fills in:
- Kit: green and white hooped jerseys, dark green shorts
- Home ground: Tallaght Stadium, artificial 3G pitch, capacity ~8,000
- Crest: circular green badge, no text in DALL-E-safe description — use "circular green crest on left chest"
- Directions: 15 mins from Tallaght village, Bus 77A, Luas Red Line to Tallaght then 10 min walk
- Social: @ShamrockRovers on Twitter/X, Facebook page
- Upload: official crest image, stadium photos, team photo

When any future article — from WhatsApp ("Rovers won last night!") or RSS (official club feed) — mentions Shamrock Rovers, the pipeline automatically:
1. Pulls the Rovers fact file from DB (instant, no API call)
2. Uses kit colours and ground description in the DALL-E prompt instead of running a web search
3. Notes the home ground as "Tallaght Stadium" (3G artificial pitch, ~8,000 capacity) in the article where relevant
4. Appends "More about Shamrock Rovers: [URL]" to the article body
5. Lists the article in the Rovers pillar page's "Latest News" section

---

### Entity Types

The admin picks a type when creating a pillar page. The type controls which fields appear in the form and which fields are injected into the AI pipeline.

| Type | Examples | Type-specific fields |
|------|----------|---------------------|
| `sports_club` | Shamrock Rovers, Tallaght FC, Thomas Davis GAA | Kit colours (home/away), home ground, league/competition, crest image |
| `venue` | Tallaght Stadium, Civic Theatre, Leisureplex | Capacity, surface type (grass/artificial/indoor), seating vs standing |
| `place` | Tallaght Library, Tallaght Hospital, The Square | Opening hours, departments/services, accessibility info |
| `business` | Smyths, Harvey Norman, Domino's Tallaght | Category, opening hours, services |
| `organisation` | SDCC, Tallaght Credit Union, TUD | Type of org, services provided, area covered |
| `event_series` | Tallaght Darkness Into Light, Patrick's Day Parade | Frequency, typical venue, typical month |

All types share common fields: name, aliases, address, directions, website, phone, photos, AI-generated body, SEO title, meta description.

---

### Examples of Pillar Pages That Would Capture High-Value Searches

| Entity | Type | Target Keywords | Search Interest |
|--------|------|----------------|-----------------|
| Shamrock Rovers | sports_club | "shamrock rovers", "rovers tallaght" | Very high (RSS already feeds this) |
| Tallaght University Hospital | place | "tallaght hospital", "TUH" | 84, recoverable |
| Tallaght Stadium | venue | "tallaght stadium" | 64, +250% 🔥 |
| The Square Shopping Centre | place | "tallaght square", "the square tallaght" | Top 3 searches |
| Tallaght Library | place | "tallaght library" | 20, +100% 🔥 |
| Civic Theatre Tallaght | venue | "civic theatre tallaght", "tallaght theatre" | 17 combined |
| Leisureplex Tallaght | venue | "leisureplex tallaght" | 5, +110% |
| Tallaght Sports Complex | venue | "tallaght sports complex" | 6, +100% |
| IMC Tallaght | venue | "cinema tallaght", "imc tallaght" | 43 combined |
| Thomas Davis GAA | sports_club | "thomas davis gaa", "gaa tallaght" | Growing |
| SDCC | organisation | "south dublin county council" | Steady (RSS already feeds this) |

---

### Admin Flow

1. Admin opens "Entity Pages" in the admin dashboard
2. Clicks "New Entity Page"
3. Picks the entity type (sports club / venue / place / business / organisation / event series)
4. Fills in the shared fields (name, aliases, address, directions, website, phone, short description)
5. Fills in type-specific fields (e.g. kit colours and home ground for a sports club)
6. Uploads photos — crest, stadium shots, fliers, official images
7. Clicks "Generate Page" — AI writes the public-facing pillar page using all provided info plus optional web search for publicly verifiable facts
8. Admin reviews and edits the generated content in a rich text editor
9. Reviews the auto-filled SEO title and meta description, tweaks if needed
10. Publishes — page goes live immediately and the AI pipeline starts using the fact file from the next article

---

### Data Model

**New DB table: `entity_pages`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial | Primary key |
| `name` | text | "Shamrock Rovers" |
| `slug` | text | "shamrock-rovers" → URL `/entity/shamrock-rovers` |
| `entityType` | text | "sports_club" / "venue" / "place" / "business" / "organisation" / "event_series" |
| `aliases` | text[] | ["Rovers", "SRFC", "Shamrock Rovers FC"] — used for name matching in articles |
| `shortDescription` | text | Admin-written 1–2 sentence summary |
| `generatedBody` | text | AI-written public page content (markdown) |
| `address` | text | |
| `directions` | text | Walking/bus/car directions written by admin |
| `website` | text | |
| `phone` | text | |
| `openingHours` | text | Free text |
| `photos` | text[] | Object storage paths — crest, photos, fliers etc. |
| `aiContext` | jsonb | Structured fact file used by the AI pipeline — see below |
| `seoTitle` | text | AI pre-filled, admin can override |
| `metaDescription` | text | AI pre-filled, admin can override |
| `status` | text | "draft" / "published" |
| `primaryCategoryId` | integer | Links to existing categories |
| `publishedAt` | timestamp | |
| `createdAt` / `updatedAt` | timestamp | |

**The `aiContext` JSONB field** is the key to the knowledge base. It is a flexible object that the pipeline reads. Examples by type:

```jsonc
// sports_club
{
  "kitHome": "green and white hooped jerseys, dark green shorts, white socks",
  "kitAway": "all-white with green trim",
  "crestDescription": "circular green badge on left chest — no text in image",
  "homeGround": "Tallaght Stadium",
  "groundSurface": "artificial 3G pitch",
  "groundCapacity": "8,000 approx",
  "league": "League of Ireland Premier Division",
  "dalleStyle": "players in green and white hooped jerseys on an artificial pitch under floodlights"
}

// venue
{
  "capacity": "8,000",
  "surfaceType": "artificial 3G",
  "seatingType": "mix of seating and terracing",
  "indoorOutdoor": "outdoor",
  "dalleStyle": "modern outdoor stadium with red and green seating, floodlit artificial pitch"
}

// place
{
  "services": ["emergency", "outpatients", "maternity"],
  "parking": "paid car park on site",
  "nearestBus": "77X, 49, 56A",
  "dalleStyle": "modern hospital building with glass facade, ambulance bay at entrance"
}
```

The `dalleStyle` field in every `aiContext` is a one-line visual description written by admin (or AI-suggested) that is dropped directly into the DALL-E prompt when the entity matches an article. This replaces the current web search (`researchEntityContext`) for known entities.

**New DB table: `entity_page_articles`** (junction — tracks which articles reference each entity)

| Column | Type | Notes |
|--------|------|-------|
| `entityPageId` | integer | FK to `entity_pages` |
| `postId` | integer | FK to `posts` |
| `linkedAt` | timestamp | |

---

### AI Pipeline Integration

This is where the knowledge base aspect comes to life. The pipeline already has a `researchEntityContext` function that runs a live web search to find visual details for DALL-E. The new flow replaces/augments that with the entity page lookup:

**Step 1 — Entity page lookup (new, runs first):**
```
At pipeline start, after extracting the headline and key facts:
1. Load all published entity page names + aliases from DB (cached per process, refreshed every 5 min)
2. Check headline + key facts text against each entity's name and aliases (case-insensitive)
3. If matched:
   a. Load full aiContext for the matched entity
   b. Use aiContext.dalleStyle as the entity context for the DALL-E prompt (free, instant, accurate)
   c. Note the entity's name, slug, and directions for use in article enrichment
   d. Skip the web search researchEntityContext call entirely (save ~€0.03 per article)
4. If no match → fall through to existing web search researchEntityContext as before
```

**Step 2 — Article body enrichment (new, optional):**
If an entity page match is found, and the entity has a `directions` field, and the article is an event at that venue, the pipeline can append a factual "Getting there:" paragraph to the article body using the admin-written directions. This adds genuine value to thin event articles without inventing anything.

**Step 3 — Pillar page linking (new):**
After the article is saved, insert a row into `entity_page_articles` and append:
```
[More about Shamrock Rovers →](https://whatsuptallaght.ie/entity/shamrock-rovers)
```
to the end of the article body. This is the internal link that feeds both Google and the reader.

**Where this hooks in to the existing code:**
- After `extractInfo` and `matchEntityInArticle` run in `ai-pipeline.ts`, add a new `matchEntityPage` call
- `matchEntityPage` checks the `entity_pages` table against the article text
- Returns `{ entityPage, aiContext }` or `null`
- If returned, `aiContext.dalleStyle` replaces `entityContext` in `buildDallePrompt`
- The existing `researchEntityContext` web search is only called if `matchEntityPage` returns null

---

### Public Site Page (`/entity/[slug]`)

Layout:
1. **Hero** — entity name as H1, first uploaded photo as hero image, type badge (Sports Club / Venue / etc.)
2. **About** — AI-generated body content (3–5 paragraphs, factual, based on admin inputs)
3. **Quick Info sidebar** — address, directions, opening hours, website, phone. For sports clubs: kit colours chip, home ground link, league
4. **Photo gallery** — all admin-uploaded images in a grid (crest, ground photos, fliers)
5. **Latest News** — auto-populated articles from `entity_page_articles`, newest first, shown as article cards
6. **Related Entities** — links to other entity pages in the same category (e.g. other sports clubs, other venues)

The page has its own `<Helmet>` block with:
- `<title>{entity.seoTitle} | What's Up Tallaght</title>`
- `<meta name="description">` from `entity.metaDescription`
- `og:image` from first photo
- JSON-LD `LocalBusiness` or `SportsOrganization` or `SportsActivityLocation` schema as appropriate

---

### Sitemap Integration

Published entity pages appear in the sitemap at `priority 0.9`, `changefreq weekly`. One extra DB query in `sitemap.ts` for `entity_pages WHERE status = 'published'`.

---

### Thin Content Fix via Entity Pages

This also partially solves the thin content problem (Fix 6). When an article is matched to an entity page, the pipeline can naturally incorporate:
- A factual sentence about the entity ("Shamrock Rovers play their home games at Tallaght Stadium, an 8,000-capacity ground with an artificial 3G surface.")
- The admin-written directions as a "Getting there" note for event articles

This adds genuine, verifiable, useful content to short articles without breaking the no-invention editorial rule — because the admin wrote the facts, not the AI.

---

### Google Trends Integration (Entity Page Enhancement)

#### The Idea

When the admin creates a pillar page for Shamrock Rovers, they also go to Google Trends, search for related terms ("shamrock rovers", "tallaght stadium", "league of ireland", etc.), download the CSV, and upload it to the entity page. The AI pipeline then reads this trend data when writing any article matched to that entity — using it to pick the search terms that real people are actually using right now.

This is a significant upgrade because the AI stops guessing at keywords and starts working from real search demand data specific to each entity.

#### What Google Trends CSVs Contain

When you download a Google Trends CSV it has several sections:
- **Interest over time** — week-by-week relative popularity (0–100) for each searched term
- **Related topics** — top and rising topics people also look at
- **Related queries** — the actual search phrases people type along with the main term, split into "Top" (established volume) and "Rising" (momentum, often shown as a % increase like +250%)

The **Related queries** section is the most useful. "Rising" queries show what people are actively starting to search for — these are the best headline keywords. "Top" queries show what's already established.

**Example for "shamrock rovers" + "tallaght stadium":**
```
Rising queries might include:
- "shamrock rovers fixtures 2026" (+400%)
- "league of ireland table 2026" (+300%)
- "rovers vs bohemians" (+200%)
- "tallaght stadium capacity" (+150%)

Top queries might include:
- "shamrock rovers fc"
- "shamrock rovers tickets"
- "tallaght stadium parking"
```

#### Admin Flow

On the entity page edit form, a new "Search Trends" section:
1. Admin goes to [trends.google.com](https://trends.google.com), searches their entity name plus any related terms (can compare up to 5 terms at once)
2. Sets the region to Ireland, time range to "Past 12 months"
3. Downloads the CSV (Google provides a download button)
4. Uploads the CSV file in the admin form
5. The server parses it immediately and shows a preview summary: top 5 rising queries, top 5 established queries, and which months show peak interest
6. Admin saves — the parsed data is stored in the entity page DB record

Multiple CSVs can be uploaded over time (e.g. one for "shamrock rovers", another for "tallaght stadium"). The system merges the rising and top queries across all uploads, deduplicates, and keeps the most recent data.

#### Data Model

A `trendsData` JSONB column on `entity_pages`:

```jsonc
{
  "lastUploadedAt": "2026-04-18T12:00:00Z",
  "searchTerms": ["shamrock rovers", "tallaght stadium"],
  "risingQueries": [
    { "query": "shamrock rovers fixtures 2026", "changePercent": 400 },
    { "query": "league of ireland table 2026", "changePercent": 300 },
    { "query": "rovers vs bohemians", "changePercent": 200 },
    { "query": "tallaght stadium capacity", "changePercent": 150 }
  ],
  "topQueries": [
    "shamrock rovers fc",
    "shamrock rovers tickets",
    "tallaght stadium parking",
    "shamrock rovers squad"
  ],
  "peakMonths": ["March", "April", "May", "September", "October"],
  "trendNote": "Interest peaks during spring and autumn league fixtures season"
}
```

The raw CSV is parsed server-side on upload and then discarded — only the structured data above is stored. The parser needs to handle the Google Trends CSV format which has multiple sections separated by blank lines, each with its own header row.

#### How the AI Pipeline Uses It

When a matched entity is found during article processing, the trends data is passed into both the headline generation step and the article writing step as additional context:

**Injected into the headline prompt:**
```
SEARCH TREND DATA for Shamrock Rovers (from Google Trends — real search demand):
- People are increasingly searching: "shamrock rovers fixtures 2026" (+400%), "league of ireland table 2026" (+300%), "rovers vs bohemians" (+200%)
- Established searches include: "shamrock rovers tickets", "tallaght stadium parking", "shamrock rovers squad"
- Peak interest months: March–May and September–October

Use this data to make the headline match how people actually search. If the article is about fixtures, use "fixtures 2026" naturally. If it's a match report, "rovers vs [opponent]" is a proven search pattern. Do NOT force keywords that don't fit the article — only use what is genuinely relevant.
```

**Injected into the article writing prompt:**
```
RELEVANT SEARCH TERMS for this entity (use naturally where they fit — do not force):
- Rising: "shamrock rovers fixtures 2026", "league of ireland table 2026"
- Established: "shamrock rovers tickets", "tallaght stadium capacity"
```

The AI instruction is explicit: use these terms only where they fit naturally. The goal is alignment with real search language, not keyword stuffing. A match report should naturally say "Shamrock Rovers" rather than "Rovers" if the trend data shows "shamrock rovers" has far higher search volume than "rovers".

#### Seasonal Awareness

If the trend data shows peak months (e.g. March–October for football), the pipeline could in future flag when an article is published outside peak season and adjust expectations accordingly. This is a nice-to-have for later.

#### What This Does Not Do

- It does not automatically update trend data — admin needs to re-download and re-upload periodically (e.g. every 3–6 months or before a new season)
- It does not use the Google Trends API directly — see the automated fetching section below for options
- It does not guarantee ranking — it improves keyword alignment, which is one of several ranking factors

---

#### Can the System Fetch Google Trends Data Automatically?

**Short answer: yes, but not for free and not officially.**

Here is the honest breakdown of what is possible:

**Option A — Google has no official Trends API**

Google does not offer a public Google Trends API. The data on [trends.google.com](https://trends.google.com) is served through internal undocumented endpoints that are not available for third-party programmatic access. Any automated solution either wraps those endpoints (unofficial, fragile) or uses a paid intermediary service.

---

**Option B — SerpApi (recommended paid option)**

[SerpApi](https://serpapi.com/google-trends-api) is a third-party service that scrapes Google Trends and returns structured JSON. It has an official Google Trends endpoint.

- **Free tier:** 100 searches per month — enough for WUT's scale if there are ~50 entity pages refreshed monthly
- **Paid:** $50/month for 5,000 searches — far more than needed
- **What it returns:** interest over time, rising queries, top queries, related topics — everything from the CSV, but as clean JSON
- **How it would work:** when admin publishes an entity page, the server calls SerpApi with the entity's name and aliases as search terms (region: IE, time: past 12 months). The response is parsed and saved to `trendsData` exactly as the CSV upload does — same DB structure, same pipeline injection
- **Refresh:** a scheduled job (e.g. first of every month, or start of football season) re-fetches for all published entity pages automatically

This is the cleanest automated approach. The free tier covers WUT's needs now. It can be wired up using just the existing `OPENAI_API_KEY` budget — SerpApi uses its own key (a new secret: `SERPAPI_KEY`).

**SerpApi call for Shamrock Rovers would look like:**
```
GET https://serpapi.com/search.json?engine=google_trends
  &q=shamrock rovers,tallaght stadium
  &geo=IE
  &date=today 12-m
  &data_type=RELATED_QUERIES
  &api_key=SERPAPI_KEY
```

Returns rising queries and top queries as structured JSON — no CSV parsing needed.

---

**Option C — DataForSEO**

[DataForSEO](https://dataforseo.com/apis/google-trends-api/) is a professional data API used by SEO agencies. It provides Google Trends data on a pay-per-request basis.

- **Cost:** approximately €0.002 per request — fetching trends for 50 entities once a month = ~€0.10/month
- **More reliable** than SerpApi for production use
- **Requires credit top-up** rather than a monthly subscription
- Slightly more complex setup but same outcome

---

**Option D — Pytrends (unofficial Python library — not recommended)**

`pytrends` is an open-source Python library that reverse-engineers the Google Trends internal API. It is commonly used for personal projects and research.

- **Free** — no API key needed
- **Fragile** — Google regularly blocks it via rate limiting and CAPTCHAs; it breaks without warning when Google changes their internal endpoints
- **Not suitable for production** — it would work during development but would intermittently fail in production, breaking trend refreshes silently
- Not recommended for WUT

---

**Recommendation for WUT**

Start with the **manual CSV upload** (already planned above) — it works today, costs nothing, and the admin only needs to do it once per entity when they set it up. Then, if automated refresh becomes a priority, **add SerpApi** — the free tier covers the volume needed for the foreseeable future, and it is a straightforward addition to the existing entity page API route. The `trendsData` DB structure is identical whether the data came from a CSV upload or a SerpApi call, so no other code changes are needed.

**Automated fetch trigger points (when building):**
1. When an entity page is first published (fetch immediately)
2. A monthly scheduled job re-fetches for all published entity pages (keeps data current)
3. Admin can also click a "Refresh Trends" button on the entity page at any time

**Additional file needed (vs CSV-only plan):**
- `artifacts/api-server/src/lib/trends-fetcher.ts` — SerpApi client; accepts entity name + aliases; returns `trendsData` object
- `artifacts/api-server/src/routes/entity-pages.ts` — call `trends-fetcher` on publish; add manual "refresh" endpoint
- A scheduled job (cron or similar) — monthly refresh for all published entity pages

---

#### Files That Would Need Changing (when building)

In addition to the existing Fix 7 file list:
- `artifacts/api-server/src/routes/entity-pages.ts` — add CSV upload endpoint; parse Google Trends CSV format; merge into `trendsData` JSONB
- `lib/db/src/schema/entity-pages.ts` — add `trendsData` jsonb column
- `artifacts/api-server/src/lib/ai-pipeline.ts` — inject `trendsData.risingQueries` and `trendsData.topQueries` into headline and article prompts when entity is matched
- `artifacts/admin-dashboard/src/pages/EntityPageEdit.tsx` — add "Search Trends" section with CSV upload + parsed preview

---

## Priority Order

1. 🔴 **Per-page meta tags** (`react-helmet-async`) — biggest Google impact, clean and safe change
2. 🔴 **robots.txt fix + sitemap updates** — simple, immediate, tells Google where to look
3. 🟠 **AI headline format** — improves all future articles automatically
4. 🟠 **Venue names in article body** — small prompt change, improves all future articles
5. 🟡 **Entity pillar pages** — biggest long-term SEO asset and AI knowledge base; medium-high complexity
6. 🟡 **Internal linking in body** — partially solved by entity page links; revisit after Fix 7
7. 🟡 **Thin content** — entity page directions/context injection is the cleanest solution; do after Fix 7

---

## Files to Change When Building

### Phase 1 files (meta tags, sitemap, AI prompts)
- `artifacts/community-website/package.json` — add `react-helmet-async`
- `artifacts/community-website/src/App.tsx` — HelmetProvider wrapper
- `artifacts/community-website/src/pages/article.tsx` — per-article Helmet block
- `artifacts/community-website/src/pages/category.tsx` — dynamic category Helmet
- `artifacts/community-website/src/pages/events.tsx` — pillar Helmet
- `artifacts/community-website/src/pages/tallaght-news.tsx` — pillar Helmet
- `artifacts/community-website/src/pages/tallaght-community.tsx` — pillar Helmet
- `artifacts/community-website/src/pages/whats-on-tallaght.tsx` — pillar Helmet
- `artifacts/community-website/src/pages/search.tsx` — pillar Helmet
- `artifacts/api-server/src/routes/sitemap.ts` — add pillar pages, serve robots.txt
- `artifacts/api-server/src/lib/ai-pipeline.ts:332` — headline instruction
- `artifacts/api-server/src/lib/ai-pipeline.ts:845–900` — writeArticle system prompt (venue names rule)

### Phase 2 files (entity page infrastructure)
- `lib/db/src/schema/entity-pages.ts` — new `entity_pages` and `entity_page_articles` tables (create)
- `lib/db/src/schema/index.ts` — export new tables
- `artifacts/api-server/src/routes/entity-pages.ts` — admin CRUD + AI page generation endpoint (create)
- `artifacts/api-server/src/routes/index.ts` — register new router
- `artifacts/api-server/src/routes/sitemap.ts` — include published entity pages
- `artifacts/admin-dashboard/src/pages/EntityPages.tsx` — admin list view (create)
- `artifacts/admin-dashboard/src/pages/EntityPageEdit.tsx` — create/edit form with type-specific fields + AI generation + photo upload (create)
- `artifacts/admin-dashboard/src/App.tsx` — register new admin routes
- `artifacts/admin-dashboard/src/lib/api.ts` — API helpers for entity pages

### Phase 3 files (public pages + AI pipeline)
- `artifacts/api-server/src/routes/public.ts` — public GET `/entity/:slug` endpoint
- `artifacts/api-server/src/lib/ai-pipeline.ts` — `matchEntityPage` function; `dalleStyle` injection into DALL-E prompt; article body enrichment; "More about X" link appended
- `artifacts/community-website/src/pages/entity.tsx` — public entity page component with hero, about, quick info, photo gallery, latest news (create)
- `artifacts/community-website/src/App.tsx` — register `/entity/:slug` route

### Phase 4 files (Google Trends CSV upload)
- `lib/db/src/schema/entity-pages.ts` — add `trendsData` jsonb column
- `artifacts/api-server/src/routes/entity-pages.ts` — add CSV upload endpoint + Google Trends CSV parser
- `artifacts/admin-dashboard/src/pages/EntityPageEdit.tsx` — add "Search Trends" section: CSV upload + parsed preview card

---

## Build Phases

### Phase 1 — Quick Wins
**Fixes covered:** 1 (meta tags), 2 (robots.txt + sitemap), 3 (AI headlines), 4 (venue names in body)
**Effort:** Small — no new DB tables, no new pages, mostly configuration and prompt changes
**Deployable standalone:** Yes — ship this first, independent of everything else

This phase fixes the two critical issues Google sees right now (every page showing the same title, and the pillar pages being invisible to search engines), and improves the quality of every article the AI writes going forward.

**What gets built:**
- Install `react-helmet-async` in the community website. Wrap the app in `HelmetProvider`. Add a `<Helmet>` block to every page type: articles (title = headline, description = first 160 chars of body, og:image = header image), category pages (title = category name + "News | What's Up Tallaght"), and each of the five existing pillar pages (events, tallaght-news, tallaght-community, whats-on-tallaght, search)
- Add JSON-LD Article schema to article pages so Google classifies them as news content
- Fix `robots.txt` — replace the Cloudflare boilerplate with a proper file that includes the `Sitemap:` directive pointing to the sitemap URL
- Add the five existing pillar pages to the sitemap at `priority 0.8`
- Update the AI headline instruction from 12-word cap to 16-word cap with explicit venue name and month/year requirements
- Add the venue full-name rule to the article writing prompt

**What admin needs to do after Phase 1:** Nothing. Every future article automatically gets a proper page title, meta description, and social share image. Every future article headline will start including the full venue name and date context.

---

### Phase 2 — Entity Page Infrastructure (Admin Side)
**Fixes covered:** Fix 7 (entity pages — database + admin UI only)
**Blocked by:** Nothing (can start immediately after Phase 1 ships)
**Effort:** Medium — new DB tables, new admin section, AI generation endpoint
**Deployable standalone:** Yes — admin can start creating entity pages even before the public pages exist (Phase 3). Pages sit in draft until Phase 3 is deployed.

This phase builds everything on the admin side. By the end of it, admin can create a full entity page for Shamrock Rovers — enter the kit colours, home ground, aliases, directions, upload photos, hit "Generate Page", review the AI-written content, and save it. It just won't be visible to the public yet.

**What gets built:**
- New DB tables: `entity_pages` (name, slug, type, aliases, address, directions, aiContext JSONB, generatedBody, seoTitle, metaDescription, photos, status, etc.) and `entity_page_articles` (junction table linking articles to entity pages)
- Run DB migration
- New admin API routes: list entity pages, create, update, delete, publish/unpublish, generate page content via AI (takes all the admin-entered fields and calls GPT-4o to write the public-facing 400–600 word page body)
- New admin dashboard section "Entity Pages":
  - List view: table of all entity pages, name, type, status, article count, last updated, link to public page
  - Create/Edit form: name, type selector (sports club / venue / place / business / organisation / event series), aliases field, address, directions, website, phone, opening hours, short description, type-specific fields (kit colours for sports clubs, capacity for venues, etc.), the `aiContext` fields including `dalleStyle`, photo uploader, "Generate Page" button, rich text editor for generated content, SEO title + meta description fields, status toggle
- Entity pages added to sitemap when published (one extra DB query, no other changes needed)

**What admin needs to do after Phase 2:** Start building entity pages. Shamrock Rovers, Tallaght Stadium, Tallaght Library, TUH — each one takes 10–15 minutes to fill in and generate. These sit as drafts until Phase 3 goes live.

---

### Phase 3 — Public Pages + AI Pipeline Integration
**Fixes covered:** Fix 7 (entity pages — public site + pipeline), Fix 5 (internal linking), Fix 6 (thin content — directions injection)
**Blocked by:** Phase 2 must be complete first (needs entity pages in DB)
**Effort:** Medium-high — new public page component, significant AI pipeline changes
**Deployable standalone:** Yes — ship after Phase 2. All draft entity pages from Phase 2 go live the moment this deploys.

This is the phase where everything connects. Entity pages go public, and the AI pipeline starts using them automatically for every new article.

**What gets built:**
- Public `/entity/:slug` page on the community website:
  - Hero section with entity name as H1, first uploaded photo, type badge
  - AI-generated About section (3–5 paragraphs)
  - Quick Info sidebar (address, directions, opening hours, website, phone; for sports clubs: kit colour chip, home ground, league)
  - Photo gallery of admin-uploaded images
  - Latest News section — live feed of all articles linked to this entity, newest first, shown as article cards
  - Related Entities section — other entity pages in the same category
  - Full `<Helmet>` block: unique title, meta description, og:image from first photo, JSON-LD schema (LocalBusiness / SportsOrganization / SportsActivityLocation as appropriate)
- AI pipeline changes (in `ai-pipeline.ts`):
  - New `matchEntityPage` function: after `extractInfo` runs, check the article headline and key facts text against all published entity names and aliases (case-insensitive, cached per process). Returns the matched entity page + its `aiContext`, or null
  - If matched: use `aiContext.dalleStyle` as the entity visual context for the DALL-E prompt — replaces the current live web search (`researchEntityContext`) for known entities, saving ~€0.03 per article and getting more accurate results
  - If matched and entity has `directions`: for event articles, append a "Getting there:" paragraph to the article body using the admin-written directions — adds genuine verifiable content to thin event articles
  - After article is saved: insert a row into `entity_page_articles`, append "More about [Entity Name] →" link to the article body — this is the internal link that feeds Google and feeds the Latest News section on the entity page
  - If no match: fall through to the existing `researchEntityContext` web search as before — no regression for unmatched articles

**What admin needs to do after Phase 3:** Nothing ongoing — it's automatic. Any new article from WhatsApp or RSS that mentions Shamrock Rovers, Tallaght Library, etc. will automatically link to the entity page and appear in its Latest News section. Admin should publish any draft entity pages from Phase 2 so they go live immediately.

---

### Phase 4A — Trends Ingestion + AI Summary
**Fixes covered:** Fix 7 enhancement (trends data — ingestion and summarisation only)
**Blocked by:** Phase 2 must be complete (needs the entity page admin form to exist)
**Effort:** Small-medium — CSV parser, new DB columns, admin UI section, one AI summarisation call
**Deployable standalone:** Yes — adds to existing entity pages, no pipeline changes yet

The goal of this phase is to get trends data into the system cleanly and have the AI produce a human-readable summary that admin can review and trust. The pipeline does not use it yet — that comes in Phase 4B, once there is confidence the summary is accurate and well-formed.

**What gets built:**

*Database:*
- New `trendsData` JSONB column on `entity_pages` — stores the raw parsed data (rising queries + top queries + peak months + upload timestamp)
- New `trendsSummary` text column on `entity_pages` — stores the AI-generated SEO summary (plain English, reviewed by admin before it ever influences articles)

*API:*
- CSV upload endpoint on the entity pages API route — accepts a Google Trends CSV file, parses the multi-section format (interest over time / related topics / related queries), extracts rising queries with % changes, top queries, and peak months, saves to `trendsData`
- After parsing, immediately calls GPT-4o to generate a `trendsSummary` — a short, plain-English paragraph that describes what the trends mean for this entity in practical terms. Example output for Shamrock Rovers:
  > "People searching for Shamrock Rovers in Ireland are increasingly using the phrase 'shamrock rovers fixtures 2026' (up 400%) and 'league of ireland table 2026' (up 300%). Interest peaks strongly from March through October, aligning with the League of Ireland season. Established searches include 'shamrock rovers tickets' and 'tallaght stadium capacity'. Articles about Rovers should naturally include fixture and league table context during the season."

*Admin UI:*
- New "Search Trends" section on the Entity Page Edit form
- Instructions: how to get the CSV from Google Trends (region: Ireland, past 12 months)
- File upload field (`.csv`)
- After upload and AI summarisation: a preview card showing:
  - The AI-written `trendsSummary` paragraph (admin reads this and decides if it makes sense)
  - Top 5 rising queries with % change
  - Top 5 established queries
  - Peak months bar or list
- Admin can edit the `trendsSummary` before saving if the AI got anything wrong
- Save button stores both `trendsData` and `trendsSummary` to the entity page

**What admin can verify after Phase 4A:** Open any entity page, upload a Google Trends CSV, read the generated summary paragraph. If it accurately describes how people search for that entity, it is ready to be used by the pipeline in Phase 4B. If it looks off, admin edits it. The summary is visible in the admin and nowhere else — articles are completely unaffected at this point.

**What admin needs to do after Phase 4A:** For the highest-priority entities, download and upload CSVs from Google Trends. Review the summaries. Correct any that look wrong. Once satisfied, these entities are ready for Phase 4B.

---

### Phase 4B — Pipeline Trend Influence
**Fixes covered:** Fix 7 enhancement (trends data — article headline and body influence)
**Blocked by:** Phase 4A must be complete and summaries must be reviewed/approved by admin
**Effort:** Small — the heavy lifting is already done; this is adding the summary to the pipeline prompt with careful guardrails
**Deployable standalone:** Yes — purely additive to the pipeline, no breaking changes

This phase wires the `trendsSummary` into the article writing pipeline. The reason it is a separate phase is that raw trend term injection can go wrong quickly — the AI can over-use terms, force them where they sound unnatural, or prioritise keyword density over readability. By using the AI-generated *summary* (rather than the raw term list), and by reviewing that summary in Phase 4A before it ever influences articles, there is a human quality gate between the trend data and what reaches readers.

**The key distinction:**
- Phase 4A injects: raw CSV data → AI → readable summary → human review
- Phase 4B injects: that reviewed summary → article pipeline → natural influence on phrasing

**What gets built:**

*AI pipeline change:*
- When a matched entity has a `trendsSummary`, append it to the article writing prompt as optional context — clearly labelled so the AI understands its role:
  ```
  SEARCH CONTEXT for [Entity Name] (use as background awareness only — do not repeat terms verbatim or force them into the article):
  [trendsSummary text]
  ```
- The same summary is passed to the headline generation step with a similar framing:
  ```
  SEARCH CONTEXT: [trendsSummary] — write the headline to reflect how people search naturally, but only if the search language genuinely fits this article.
  ```
- If `trendsSummary` is empty or the entity has no trends data, behaviour is unchanged — no fallback needed

*Guardrails built into the prompt instruction:*
- The AI is told the summary is background context, not a list of terms to include
- It is explicitly told not to repeat terms verbatim or use them where they don't fit
- The framing mirrors how a good editor would brief a journalist: "people search for 'fixtures 2026' a lot this season — keep that in mind when you write the headline" rather than "include the phrase fixtures 2026"

*Admin monitoring:*
- No new UI needed — admin reviews articles as normal and can judge whether the trend influence is working well or being overdone
- If the influence looks heavy-handed on a specific entity, admin can edit that entity's `trendsSummary` to tone it down (e.g. remove specific phrases that the AI is overusing), without touching any code

**What admin needs to do after Phase 4B:** Monitor the first few articles for each entity that has trend data. Check that headlines read naturally and that the article body doesn't feel like it's straining to include keywords. If something looks off, edit the entity's trend summary in the admin to soften it.

---

### Summary Table

| Phase | What It Builds | Effort | Google Impact | When to Ship |
|-------|---------------|--------|---------------|--------------|
| 1 | Meta tags, robots.txt, sitemap, AI prompts | Small | Immediate — fixes critical SEO gaps | First, standalone |
| 2 | Entity pages: DB + admin UI | Medium | None yet (admin only) | After Phase 1 |
| 3 | Entity pages: public site + AI pipeline | Medium-high | High — new rankable pages + smarter articles | After Phase 2 |
| 4A | Trends ingestion: CSV upload + AI summary | Small-medium | None yet — data collection and review only | After Phase 2 |
| 4B | Trends influence: summary into pipeline | Small | Medium — better keyword alignment, safely gated | After 4A reviewed |

Phases 3 and 4A are independent of each other once Phase 2 is done and can run in parallel. Phase 4B should only ship after Phase 4A summaries have been reviewed and trusted.
