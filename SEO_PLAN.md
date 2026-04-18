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

## Fix 7 — AI-Generated Place Pillar Pages (Admin-Driven)

### Concept

The single biggest SEO opportunity beyond fixing meta tags is owning search results for specific Tallaght locations. People search for "tallaght hospital", "tallaght stadium", "tallaght library" — not generic news. A pillar page for each major Tallaght place/venue gives the site a permanent, content-rich destination that:

1. Ranks for the location's name as a keyword
2. Acts as a hub that all related articles link into
3. Grows in authority over time as more articles reference it

### How It Would Work

**Admin flow:**
1. Admin goes to a new "Place Pages" section in the admin dashboard
2. Creates a new place by entering: name, short description, address/area, website URL (optional)
3. Uploads photos (from their phone, fliers, official images)
4. Hits "Generate Page" — AI writes the pillar page content from the provided info
5. Admin reviews, edits if needed, publishes

**What the AI generates from the admin's inputs:**
- A 400–600 word informational page about the place (factual, based only on what admin provided + any publicly verified facts from web search)
- SEO title and meta description targeting the place's search name (e.g. "Tallaght University Hospital | Local Guide & News")
- Structured sections: About, Location & Directions, Opening Hours (if provided), Recent News (auto-populated from linked articles)

**Article linking (automatic):**
- When any new article is processed (WhatsApp or RSS), the AI pipeline checks if the article mentions any published place pillar page (by name matching against a stored list of place names and their aliases)
- If a match is found, a "Learn more about [Place Name]" link is appended to the article body, and the article is listed in the place's "Recent News" section
- The entity matching system that already exists (`matchEntityInArticle`) is the natural home for this logic — place pillar pages would be a type of entity

**Examples of place pillar pages that would capture high-value searches:**

| Place | Target Keywords | Current Search Interest |
|-------|----------------|------------------------|
| Tallaght University Hospital | "tallaght hospital", "TUH tallaght", "tallaght university hospital" | 84 (search interest), -30% trend — recoverable |
| Tallaght Stadium | "tallaght stadium", "stadium tallaght" | 64, +250% 🔥 |
| The Square Shopping Centre | "tallaght square", "square tallaght", "the square tallaght" | Top 3 searches |
| Tallaght Library | "tallaght library" | 20, +100% 🔥 |
| Civic Theatre Tallaght | "civic theatre tallaght", "tallaght theatre" | 17 combined |
| Leisureplex Tallaght | "leisureplex tallaght" | 5, +110% |
| Tallaght Sports Complex | "tallaght sports complex" | 6, +100% |
| IMC Tallaght (cinema) | "cinema tallaght", "imc tallaght" | 43 combined |
| TUD Tallaght | "tud tallaght" | 9, -40% but educational |

### Data Model (what needs building)

**New DB table: `place_pages`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial | Primary key |
| `name` | text | "Tallaght University Hospital" |
| `slug` | text | "tallaght-university-hospital" (URL: `/place/tallaght-university-hospital`) |
| `aliases` | text[] | ["TUH", "tallaght hospital", "university hospital tallaght"] — used for article matching |
| `shortDescription` | text | 1-2 sentence admin-entered description |
| `generatedBody` | text | AI-written page content (HTML or markdown) |
| `address` | text | |
| `directions` | text | Admin-entered walking/bus/car directions |
| `website` | text | Official URL |
| `phone` | text | |
| `openingHours` | text | Free text |
| `photos` | text[] | Stored object storage paths |
| `seoTitle` | text | AI-generated or admin-overridden |
| `metaDescription` | text | AI-generated or admin-overridden |
| `status` | enum | draft / published |
| `primaryCategoryId` | integer | Links to existing categories (e.g. "health", "sport") |
| `publishedAt` | timestamp | |
| `createdAt` / `updatedAt` | timestamp | |

**New DB table: `place_page_articles`** (junction table)

| Column | Type | Notes |
|--------|------|-------|
| `placePageId` | integer | FK to `place_pages` |
| `postId` | integer | FK to `posts` |
| `linkedAt` | timestamp | When the match was made |

### Admin UI (new "Place Pages" section)

**List view:**
- Table of all place pages with name, status (draft/published), article count, last updated
- "New Place Page" button

**Create/Edit form:**
- Name field (required)
- Aliases field (comma-separated — used for article auto-matching)
- Short description textarea (what admin knows about the place)
- Address, directions, opening hours, website, phone fields
- Photo uploader (multi-image, same object storage as existing images)
- "Generate Page" button — sends to AI, shows generated content in a preview editor
- Admin can edit the generated content before publishing
- SEO title and meta description fields (AI pre-fills, admin can override)
- Status toggle (draft / published)

**After publishing:**
- The place page appears at `/place/[slug]` on the public site
- The admin sees an "Articles" tab showing all articles matched to this place

### Public Site Page (`/place/[slug]`)

Structure:
1. **Hero** — place name as H1, hero photo (first uploaded photo or AI-generated fallback), address/directions
2. **About** — AI-generated body (3–5 paragraphs based on admin inputs)
3. **Quick Info** — opening hours, website, phone (if provided) as a sidebar card
4. **Photos** — gallery of admin-uploaded images
5. **Latest News** — auto-populated list of articles linked to this place, newest first
6. **Related Places** — links to other nearby/related place pages (manually set or by category)

### AI Pipeline Integration (article → place linking)

When an article is created or published, the pipeline runs an extra step:
1. Fetch all published place page names + aliases from DB (can be cached)
2. Check if any appear in the article title or body (case-insensitive)
3. If matched, insert a row into `place_page_articles` and append a "More about [Place Name]: [URL]" line to the article body
4. This is non-blocking — if it fails, the article still publishes normally

The existing `matchEntityInArticle` function in `ai-pipeline.ts` already does something similar for sports clubs/organisations. Place pages are a natural extension of this pattern.

### Sitemap Integration

When a place page is published, its URL is added to the sitemap at `priority 0.9` and `changefreq weekly`. The sitemap route already generates dynamically from the DB — a new query for `place_pages WHERE status = 'published'` is all that's needed.

---

## Priority Order

1. 🔴 **Per-page meta tags** (`react-helmet-async`) — biggest Google impact, clean and safe change
2. 🔴 **robots.txt fix + sitemap pillar pages** — simple, immediate, tells Google where to look
3. 🟠 **AI headline format** — improves all future articles automatically
4. 🟠 **Venue names in article body** — small prompt change, improves all future articles
5. 🟡 **Place pillar pages (admin-driven)** — biggest long-term SEO asset; medium complexity
6. 🟡 **Internal linking in body** — some of this is solved by place page links; revisit after Fix 7
7. 🟡 **Thin content strategy** — web-search venue context is the most promising angle; do after place pages exist

---

## Files to Change When Building

### Fixes 1–5 (meta tags, sitemap, AI prompts)
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

### Fix 7 (Place Pillar Pages)
- `lib/db/src/schema/place-pages.ts` — new table (create)
- `lib/db/src/schema/index.ts` — export new table
- `artifacts/api-server/src/routes/place-pages.ts` — CRUD + AI generation endpoint (create)
- `artifacts/api-server/src/routes/index.ts` — register new router
- `artifacts/api-server/src/routes/public.ts` — public GET `/place/:slug` endpoint
- `artifacts/api-server/src/routes/sitemap.ts` — include published place pages
- `artifacts/api-server/src/lib/ai-pipeline.ts` — place-matching step after article write
- `artifacts/admin-dashboard/src/pages/PlacePages.tsx` — admin list + create/edit UI (create)
- `artifacts/admin-dashboard/src/pages/PlacePageEdit.tsx` — create/edit form with AI generation (create)
- `artifacts/admin-dashboard/src/App.tsx` — register new admin routes
- `artifacts/admin-dashboard/src/lib/api.ts` — API helpers for place pages
- `artifacts/community-website/src/pages/place.tsx` — public place page component (create)
- `artifacts/community-website/src/App.tsx` — register `/place/:slug` route
