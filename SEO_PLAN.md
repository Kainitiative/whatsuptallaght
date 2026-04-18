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

### Fixes 1–6 (meta tags, sitemap, AI prompts)
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

### Fix 7 (Entity Pillar Pages + AI Knowledge Base)
- `lib/db/src/schema/entity-pages.ts` — new `entity_pages` and `entity_page_articles` tables (create)
- `lib/db/src/schema/index.ts` — export new tables
- `artifacts/api-server/src/routes/entity-pages.ts` — admin CRUD + AI generation endpoint (create)
- `artifacts/api-server/src/routes/index.ts` — register new router
- `artifacts/api-server/src/routes/public.ts` — public GET `/entity/:slug` endpoint
- `artifacts/api-server/src/routes/sitemap.ts` — include published entity pages
- `artifacts/api-server/src/lib/ai-pipeline.ts` — `matchEntityPage` function; entity context injected into DALL-E prompt; article body enrichment; pillar link appended
- `artifacts/admin-dashboard/src/pages/EntityPages.tsx` — list view (create)
- `artifacts/admin-dashboard/src/pages/EntityPageEdit.tsx` — create/edit form with type-specific fields + AI generation + photo upload (create)
- `artifacts/admin-dashboard/src/App.tsx` — register new admin routes
- `artifacts/admin-dashboard/src/lib/api.ts` — API helpers for entity pages
- `artifacts/community-website/src/pages/entity.tsx` — public entity page component (create)
- `artifacts/community-website/src/App.tsx` — register `/entity/:slug` route
