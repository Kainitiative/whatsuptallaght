# What's Up Tallaght (WUT) — Platform Overview

## Project Summary

WhatsApp-first AI community news platform for Tallaght, Dublin. Community members submit stories via WhatsApp; the AI pipeline processes them into published articles at **whatsuptallaght.ie**. Articles auto-post to Facebook. Additional content sourced from RSS feeds and Eventbrite. Managed via an admin dashboard.

- **Production URL**: https://whatsuptallaght.ie
- **GitHub repo**: `Kainitiative/whatsuptallaght`
- **VPS**: `root@185.43.233.219` — app at `/opt/whatsuptallaght/`, deploy via `docker compose`
- **Admin password**: set via `ADMIN_PASSWORD` env var (current: `tallaght-admin`)
- **Production DB**: `postgresql://wut:wut_prod_2024@localhost:5432/wut`
- **Facebook Page ID**: `977887435417701`; App ID `1004031388620003`

---

## Workspace Structure

pnpm monorepo. Node.js 24, TypeScript 5.9.

```text
artifacts/
  api-server/          Express 5 API server (all backend logic lives here)
  admin-dashboard/     React + Vite admin UI
  community-website/   React + Vite public website
  mockup-sandbox/      Vite component preview server (dev only)
lib/
  api-spec/            OpenAPI 3.1 spec + Orval codegen config
  api-client-react/    Generated React Query hooks + fetch client
  api-zod/             Generated Zod schemas from OpenAPI
  db/                  Drizzle ORM schema + DB connection
scripts/               Utility scripts
```

### TypeScript & Composite Projects

Every package extends `tsconfig.base.json` (`composite: true`). Always typecheck from root:
```bash
pnpm run typecheck          # tsc --build --emitDeclarationOnly
pnpm run build              # typecheck + all package builds
pnpm --filter @workspace/api-spec run codegen   # regenerate API client after spec changes
```

In production, migrations run automatically on startup (`drizzle-orm/node-postgres/migrator`).
In development, use `pnpm --filter @workspace/db run push`.

---

## API Server (`artifacts/api-server`)

- **Entry**: `src/index.ts` — reads `PORT`, seeds settings/feeds/demo, starts Express, starts workers
- **App setup**: `src/app.ts` — CORS, JSON parsing, sitemap, `/api` router, static file serving (production), OG meta injection for `/article/:slug`
- **Build**: esbuild CJS bundle (`dist/index.cjs`), migrations folder copied at build time
- **Static serving**: In production, Express serves both the community website (at `/`) and admin dashboard (at `/admin`)

### Route files (`src/routes/`)

| File | Prefix | Purpose |
|---|---|---|
| `health.ts` | `/api/health` | Health check |
| `submissions.ts` | `/api/submissions` | WhatsApp submission management |
| `posts.ts` | `/api/posts` | Article CRUD, publish, regenerate image |
| `categories.ts` | `/api/categories` | Category management |
| `rss.ts` | `/api/rss-feeds` | RSS/Eventbrite feed management |
| `settings.ts` | `/api/settings` | Encrypted settings store |
| `admin.ts` | `/api/admin` | Admin-only operations |
| `public.ts` | `/api/public` | Public-facing endpoints (articles, search, events) |
| `entities.ts` | `/api/admin/entities` | Entity library CRUD |
| `image-assets.ts` | `/api/admin/image-assets` | Header image asset library |
| `events.ts` | `/api/events` | Events calendar |
| `contributors.ts` | `/api/contributors` | Contributor management |
| `competitions.ts` | `/api/competitions` | Competitions |
| `social.ts` | `/api/social` | Social captions |
| `usage.ts` | `/api/usage` | AI usage/cost tracking |
| `stats.ts` | `/api/stats` | Platform stats |
| `storage.ts` | `/api/storage` | Object storage serving |
| `sitemap.ts` | `/sitemap.xml` | Sitemap |
| `webhook.ts` | `/api/webhooks/whatsapp` | WhatsApp webhook |
| `webhook-facebook.ts` | `/api/webhooks/facebook` | Facebook webhook |
| `golden-examples.ts` | `/api/golden-examples` | Few-shot training examples |

---

## Database Schema (`lib/db/src/schema/`)

| Table | Purpose |
|---|---|
| `submissions` | Raw WhatsApp inputs (text, audio, images); status tracks pipeline progress |
| `posts` | Published/held/draft articles; `headerImageUrl`, `bodyImages[]`, `imagePrompt`, `matchedEntityId` |
| `categories` | Article categories with slugs and colours |
| `rss_feeds` | Feed URLs with `feedType` (`rss` \| `eventbrite`), interval, trust level, filter mode |
| `rss_items` | Deduplicated items from all feeds; linked to posts on processing |
| `contributors` | WhatsApp contributors; hashed phone, consent status, ban flag |
| `entities` | Entity library — orgs, venues, teams with image URLs and aliases |
| `header_image_assets` | Reusable DALL·E generated header images; keyed by tone + topic keywords |
| `events` | Structured event records linked to posts |
| `job_queue` | Async processing queue with retry scheduling |
| `ai_usage_log` | Per-call OpenAI token and cost tracking |
| `settings` | Encrypted key-value settings store |
| `golden_examples` | Few-shot article examples for the AI writer |
| `social_captions` | AI-generated Facebook/Twitter/Instagram captions per post |
| `competitions` | Competitions with entry management |

**Current migrations**: `0000` through `0004` (latest: adds `feed_type` column to `rss_feeds`).

---

## AI Pipeline (`src/lib/ai-pipeline.ts`)

### WhatsApp pipeline (`processWhatsAppSubmission`)

1. **Safety check** — OpenAI Moderation API (free)
2. **Audio transcription** — Whisper for voice notes
3. **Image description** — GPT-4o Vision; submitted photos stored as `bodyImages`
4. **Tone classification** — GPT-4o-mini (JSON); assigns category
5. **Info extraction** — GPT-4o-mini; headline, location, date, key facts, completeness score
5b. **Event extraction** — GPT-4o-mini; runs when tone = event or date detected
6. **Article writing** — GPT-4o with tone guide + golden examples
7. **Fact-check** — GPT-4o-mini compares article against submission; FAIL → held
7b. **Header image** — entity image > DALL·E asset library > none
7c. **Confidence routing** — ≥0.75 + factCheck PASS → published; 0.40–0.74 → held; <0.40 → rejected
8. **Social captions** — GPT-4o-mini generates Facebook/Twitter/Instagram variants
9. **Facebook post** — photo upload (direct image) or link post fallback

### RSS/Eventbrite pipeline (`processRssSubmission`)

Same stages but lighter (no media, no WhatsApp replies). Trust level affects auto-publish threshold. Uses GPT-4o-mini for article rewrite. Fact-checked same as WhatsApp pipeline.

### Header image asset library (`findOrCreateHeaderAsset`)

Before generating a new DALL·E image, the pipeline checks `header_image_assets` for a matching asset (same tone + ≥2 overlapping topic keywords from headline). If found and under reuse limit (50 articles), reuses it. Otherwise generates new via DALL·E 3 (`1792x1024`, HD quality) and stores to library.

### Facebook posting (`src/lib/facebook-poster.ts`)

When a `headerImageUrl` or `bodyImages[0]` is available:
1. Uploads the image directly to the Facebook Page (`/{pageId}/photos`, `published: false`)
2. Creates a feed post with `attached_media` referencing the uploaded photo ID
3. Caption = excerpt + article URL on new line

Falls back to a link post (OG-based) when no image is available, preceded by an OG rescrape trigger.

---

## RSS / Eventbrite Fetcher (`src/lib/rss-fetcher.ts`)

- `startRssScheduler()` — polls every 5 minutes; checks each feed against its `checkIntervalMinutes`
- Deduplication by GUID — items never processed twice
- Geo-filter — `isRelevantToTallaght()` — 40+ keyword/place-name match
- Events-only filter — per-feed opt-in (`filterMode: "events_only"`)
- `feedType: "rss"` — standard RSS/Atom parser
- `feedType: "eventbrite"` — `fetchEventbritePage()` scrapes JSON-LD from Eventbrite listing pages

### Eventbrite scraper (`fetchEventbritePage`)

Fetches the Eventbrite listing page HTML and extracts all JSON-LD `ItemList` event entries. For each event extracts:
- Title, description, start/end date+time (formatted human-readable)
- Venue name + full address
- Organiser name
- Ticket price (with currency) + ticket URL
- Event image URL

All fields included in the content block passed to the AI — article writer is instructed to always include venue, price, and ticket link for event articles.

### Active feeds

| Feed | Type | Interval | Trust |
|---|---|---|---|
| Transport for Ireland | RSS | 20 min | official |
| The Journal | RSS | 30 min | news |
| Dublin Live | RSS | 30 min | news |
| Eventbrite — Tallaght Library | Eventbrite | 6 hr | general |
| Eventbrite — Tallaght | Eventbrite | 6 hr | general |

SDCC RSS removed by source — disabled. Garda blocks cloud IPs — disabled (works on VPS). Met Éireann RSS removed — disabled.

---

## OG Meta Injection (`src/app.ts`)

In production, Express intercepts every `GET /article/:slug` request before the static file middleware. It fetches the article from the DB and rewrites the OG and Twitter meta tags in the HTML shell:
- `og:title` / `twitter:title` → article title
- `og:description` / `twitter:description` → article excerpt
- `og:image` / `twitter:image` → `bodyImages[0]` ?? `headerImageUrl` (resolved to absolute URL)
- `og:url` → canonical article URL

This ensures Facebook, WhatsApp link previews, and Twitter cards always show article-specific images — not the generic site image.

---

## Watermarking (`src/lib/watermark.ts`)

All images stored via `uploadImageBuffer()` receive the WUT white logo watermarked to the bottom-left (28% image width, 2.5% margin) using `sharp`. Output is always JPEG quality 88. Falls back silently if compositing fails.

---

## Entity Library (`src/lib/entity-matcher.ts`)

After article writing, `matchEntityInArticle()` checks the article body against all entities in the DB using whole-word string matching against names and aliases. If matched with sufficient centrality, the entity's stored image is used as the header image (overrides DALL·E, loses to submitted photos).

Pre-loaded: St Marks GAA Club, Tallaght University Hospital (TUH/AMNCH), Tallaght Library, Tallaght Community School, Rua Red Arts Centre.

---

## Social Captions (`src/lib/social-caption-agent.ts`)

After article is written, `generateAndStoreSocialCaptions()` uses GPT-4o-mini to generate three platform-specific caption variants (Facebook, Twitter, Instagram). Stored in `social_captions` table. Admin can view and override before posting.

---

## Weekend Roundup (`src/lib/weekend-roundup-scheduler.ts`)

Scheduled job that assembles a weekend event roundup article from upcoming events in the DB. Runs on a configured schedule (Friday afternoon by default).

---

## Queue Worker (`src/lib/queue-worker.ts`)

- Polls `job_queue` every 5 seconds
- Atomic job claiming via `FOR UPDATE SKIP LOCKED`
- Job types: `PROCESS_WHATSAPP_SUBMISSION`, `PROCESS_RSS_SUBMISSION`
- Retry schedule: 60s → 5min → 15min → permanent failure

---

## WhatsApp Integration (`src/lib/whatsapp-client.ts`)

- `POST /api/webhooks/whatsapp` — validates HMAC-SHA256; returns 200 immediately; queues async
- GDPR consent flow: new contributors held at `awaiting_consent`; YES reply consents + re-queues
- Phone numbers hashed (SHA-256) — never stored in plaintext
- Commands: STOP, HELP, MY POSTS, STATUS, DELETE
- `sendTextMessage(to, body)` — Meta Cloud API
- `downloadMedia(mediaId)` — resolves temp URL and downloads

---

## Settings (encrypted)

All credentials stored encrypted in the `settings` table. Key settings:

| Key | Purpose |
|---|---|
| `openai_api_key` | GPT-4o, Whisper, Moderation, DALL·E |
| `whatsapp_access_token` | Meta Cloud API |
| `whatsapp_phone_number_id` | Meta phone number |
| `whatsapp_webhook_verify_token` | Webhook verification |
| `whatsapp_app_secret` | Signature validation |
| `facebook_page_id` | Facebook Page ID |
| `facebook_page_access_token` | Page access token |
| `platform_url` | Base URL (https://whatsuptallaght.ie) |
| `auto_generate_images` | `"true"` / `"false"` — DALL·E generation toggle |

---

## Community Website Features

- Home page with featured articles and recent news
- Article pages with header image, body, event details card, related articles
- Events calendar page
- Search (`/search?q=`) — PostgreSQL full-text search across title/excerpt/body
- WhatsApp submission CTA throughout
- Category pages
- About page
- Sitemap at `/sitemap.xml`

---

## Admin Dashboard Features

- **Articles** — list, expand, edit, publish/unpublish/delete, regenerate image, re-scan entity, extract event, post to Facebook, view AI cost breakdown
- **RSS Feeds** — add/edit/delete feeds; `feedType` selector (RSS vs Eventbrite); Eventbrite badge in list
- **Submissions** — raw WhatsApp submissions with status
- **Contributors** — list, ban/unban
- **Events** — upcoming/past events calendar management
- **Entity Library** — add/edit/delete entities with image upload and alias management
- **Image Assets** — header image asset library viewer
- **Competitions** — competition management
- **Settings** — all encrypted settings via UI
- **AI Usage** — platform-wide token and cost breakdown by stage and model
- **Golden Examples** — few-shot training examples for the AI writer

---

## Planned / Not Yet Built

### Facebook webhook (one-time setup pending)
Go to developers.facebook.com → App → Webhooks → Page → Edit. Set:
- Callback URL: `https://whatsuptallaght.ie/api/webhooks/facebook`
- Verify Token: from Settings in admin
- Subscribe to: `feed` field

### Newsletter system
Monthly newsletter compiled from top articles. WhatsApp + email delivery. Subscribers opt in via website form or WhatsApp. Not yet built.

### Community reaction pieces ("Have Your Say")
Hashtag-based WhatsApp reactions to articles synthesised by AI into companion "Community Reacts" pieces. Data model designed, not yet built.

### Social media comments → AI opinion pieces
Read Facebook/Instagram comments on shared articles via Graph API; synthesise into reaction pieces. Requires additional Graph API permissions.

### Multi-image grouping (WhatsApp)
Album detection + 10-second time-window to group multiple images from the same contributor into one submission. Not yet built.

### Video upload handling
Audio extraction + frame sampling for WhatsApp video submissions. Always held for review. Not yet built.

### AI Clarification Loop
After info extraction, AI asks contributor one follow-up question via WhatsApp (vague location, unconfirmed name, etc.) before writing the article. Not yet built.

### Newsletter sponsorship / business features
Ad slots in newsletter issues, AI-written business feature articles, enhanced directory listings, category sponsorship. Not yet built.
