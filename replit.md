# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### WhatsApp + AI Pipeline (`artifacts/api-server/src/`)

Phase 2b — WhatsApp ingestion and AI processing pipeline. All files live in the API server.

**Webhook** (`src/routes/webhook.ts`):
- `GET /api/webhooks/whatsapp` — Meta verification handshake (checks `whatsapp_webhook_verify_token` setting)
- `POST /api/webhooks/whatsapp` — Incoming messages; validates HMAC-SHA256 signature if `whatsapp_app_secret` is set; returns 200 immediately; processes async
- Phone numbers are hashed (SHA-256) before storage — never stored in plaintext
- Contributors auto-created on first message; duplicate-safe
- Checks `isBanned` before processing
- STOP/HELP commands work without consent (always handled)
- **GDPR consent flow** (implemented):
  1. New contributor → submission held as `awaiting_consent`, consent message sent with Terms/Privacy links
  2. Contributor replies **YES** → `consentStatus` set to `consented`, all held `awaiting_consent` submissions re-queued for AI processing
  3. Contributor replies **NO** → `consentStatus` set to `declined`, no further processing; reminder offered
  4. Already-consented → normal flow
  5. Declined contributor sends message → reminded they can reply YES to change mind
- `contributors` table: `consentStatus` (`pending` | `consented` | `declined`), `consentGivenAt` timestamp
- `submissions` table: `awaiting_consent` status added to enum for held submissions

**WhatsApp client** (`src/lib/whatsapp-client.ts`):
- `sendTextMessage(to, body)` — sends via Meta Cloud API
- `downloadMedia(mediaId)` — resolves temporary URL then downloads; returns `{buffer, mimeType}`
- All credentials fetched from encrypted settings at call time

**Command handler** (`src/lib/commands.ts`):
- `isCommand(text)` — detects commands
- `handleCommand(phone, contributorId, text)` — dispatches HELP / MY POSTS / STATUS / DELETE / STOP

**AI Pipeline** (`src/lib/ai-pipeline.ts`):
- Stage 1: OpenAI Moderation API (free) — safety gate; rejects + bans on failure
- Stage 2: Whisper transcription for audio messages
- Stage 3: GPT-4o Vision for image messages
- Stage 4: GPT-4o-mini tone classification (JSON)
- Stage 5: GPT-4o-mini info extraction — headline, location, date, key facts, completeness score (JSON)
- Stage 6: GPT-4o article writing — uses golden examples for few-shot prompting
- Stage 7: Confidence routing — ≥ 0.75 → auto-publish; < 0.75 → held; < 0.4 → reject
- Sends WhatsApp notification on completion (published / held / rejected)

**Queue worker** (`src/lib/queue-worker.ts`):
- `startQueueWorker()` — polls `job_queue` table every 5 seconds
- Atomic job claiming via `FOR UPDATE SKIP LOCKED`
- Retry schedule: 60s → 5min → 15min, then permanent failure
- Job type: `PROCESS_WHATSAPP_SUBMISSION`

**Credentials required (set via admin settings):**
- `openai_api_key` — GPT-4o, Whisper, Moderation
- `whatsapp_access_token` — Meta Cloud API
- `whatsapp_phone_number_id` — Meta phone number
- `whatsapp_webhook_verify_token` — webhook verification
- `whatsapp_app_secret` — signature validation (optional but recommended)

### RSS Ingestion (`artifacts/api-server/src/lib/`)

Phase 2c — RSS feed ingestion with Tallaght geo-filtering and AI rewriting.

**Geo-filter** (`src/lib/geo-filter.ts`):
- `isRelevantToTallaght(feedUrl, title, content)` — two-pass filter
- Pass 1: Feed-level always-relevant check (SDCC only — 100% South Dublin scope)
- Pass 2: Keyword match across 40+ Tallaght/South Dublin place names, infrastructure, and institution keywords
- `getFeedTrustLevel(feedUrl)` — returns "official" / "news" / "general" for AI pipeline routing

**RSS Fetcher** (`src/lib/rss-fetcher.ts`):
- `startRssScheduler()` — polls every 5 minutes, respects per-feed `checkIntervalMinutes`
- On each run: fetches all active feeds that are due, deduplicates by GUID
- Stores all items (relevant or not) in `rss_items` for analytics
- Queues `PROCESS_RSS_SUBMISSION` jobs for relevant items
- Handles 403/404/timeouts gracefully — updates `lastFetchedAt` regardless
- `onConflictDoNothing` prevents race conditions on duplicate GUIDs

**RSS AI Pipeline** (in `src/lib/ai-pipeline.ts`):
- Lighter than WhatsApp pipeline — no media processing, no WhatsApp replies
- Uses GPT-4o-mini for rewriting (cheaper than GPT-4o; content is already structured)
- Trust-level routing: `official` → auto-publish (≥ 0.75 confidence), `news` → hold, `general` → hold
- Updates `rss_items.post_id` when article is created

**Active feeds (as of April 2026):**
- Transport for Ireland (`/feed/`) — keyword-filtered, 20 min interval ✅
- The Journal (`thejournal.ie/feed/`) — keyword-filtered, 30 min interval ✅
- Dublin Live (`dublinlive.ie`) — keyword-filtered, 30 min interval ✅
- SDCC: RSS removed by SDCC — disabled
- Garda: blocks cloud IPs — disabled (re-enable on VPS)
- Met Éireann: RSS removed — disabled

**Seed management:**
- `DEPRECATED_URLS` array in seed-rss-feeds.ts auto-disables old/broken URLs on each startup
- `onConflictDoUpdate` now also syncs `isActive` so deactivations propagate correctly

---

## Planned Features (not yet built)

### AI-generated article header images (DALL·E 3)

#### Concept
When an article has no header image (most WhatsApp submissions and RSS articles), the AI generates a contextually appropriate image using DALL·E 3 and stores it as the article's `headerImageUrl`. This dramatically improves visual impact on the home page and article pages.

#### How it works
- **Trigger**: After article writing (Stage 6 of the AI pipeline), if no image was submitted with the original content, add an optional Stage 7: image generation
- **Prompt construction**: Use the article headline + key facts (already extracted in Stage 5) to build a DALL·E 3 prompt. The prompt should describe a scene relevant to the article — not logos or brands.
- **Style guidance in prompt**: "photorealistic community news photography style, no text, no watermarks, vibrant but factual" — avoids AI-looking imagery
- **Special cases**:
  - **Sports/partnership articles**: use team colours and symbolic imagery (e.g. two sets of kit colours, trophies, stadium) rather than actual logos (DALL·E will not render real logos reliably)
  - **Events**: crowd scenes, event venue, community gathering
  - **Infrastructure/transport**: roads, buses, Luas, cycling lanes
  - **Community notices**: local streets, community centre settings

#### Image storage
- Generated images are returned as URLs from OpenAI's CDN (expire after ~1 hour) — must be downloaded immediately and stored
- Use Replit Object Storage (already configured in the project) to store images permanently
- Store the public Object Storage URL in `posts.header_image_url`

#### Cost
- DALL·E 3 standard quality 1024×1024: ~$0.04 per image
- Only generate when no image already exists — WhatsApp image submissions skip this step
- Could be made opt-in per feed trust level (e.g. skip for "official" feeds that don't need it)
- Admin toggle: "Auto-generate images" on/off in Settings

#### Admin controls
- Article detail view: "Regenerate image" button — re-runs DALL·E with the same prompt
- "Edit prompt" — admin can tweak the image prompt before regenerating
- Show the DALL·E prompt used so admin can understand why the image looks as it does

#### Implementation notes
- Add `imagePrompt` field to `posts` table (text, nullable) — stores the prompt used for transparency/debugging
- `object-storage` skill already covers the upload pattern
- Coordinate with the existing `headerImageUrl` field — no schema changes needed beyond `imagePrompt`

#### Logo compositing extension (builds on top of DALL·E generation)
For RSS feeds from clubs, organisations, or brands with a recognisable logo:
- Add a `logoUrl` field to `rss_feeds` table — admin pastes in the URL of the feed's logo image once (e.g. `https://www.shamrockrovers.ie/wp-content/uploads/rovers-crest.png`)
- After DALL·E generates the background scene, download the logo and composite it onto the image using **`sharp`** (Node.js, no extra API cost)
- Placement: bottom-left or bottom-right corner, ~15% of image width, with a subtle white circle/badge background for visibility
- For partnership articles (two clubs): composite both logos side by side with a thin divider or "×" between them
- Logo fetch: download at runtime and cache in Object Storage so it's not re-fetched on every article
- **Copyright note**: editorial use of club logos for news reporting is standard press practice. Avoid any framing that implies endorsement.

---

### Social media comments → AI opinion pieces

#### Concept
When an article is shared to Facebook or Instagram, public comments from the community on that post become a rich source of opinion. The AI can read those comments, run them through the same moderation + sentiment pipeline as WhatsApp reactions, and generate a "Community Reacts" companion piece — exactly like the WhatsApp hashtag reaction system, but sourced from social media engagement.

#### How comment reading works
Both Facebook and Instagram (Business) expose comments via their Graph API:
- **Facebook**: `GET /{facebook-post-id}/comments` — returns commenter name, message, timestamp, likes count
- **Instagram**: `GET /{instagram-media-id}/comments` — same structure

When posting to social media (the planned social distribution feature), the API already receives back the platform post ID. That ID needs to be saved to the article record at post time.

#### Data model additions
**`posts` table — new columns:**
- `facebook_post_id` — the Facebook page post ID returned after publishing (e.g. `123456_789012`)
- `instagram_media_id` — the Instagram media ID returned after publishing

**New `social_comments` table:**
| Column | Notes |
|---|---|
| `id` | serial PK |
| `article_id` | FK → `posts.id` |
| `platform` | `facebook` \| `instagram` |
| `platform_comment_id` | Platform's own comment ID (for deduplication) |
| `commenter_name` | Display name (never shown publicly in generated piece) |
| `raw_text` | Comment text |
| `safety_passed` | Boolean — moderation result |
| `sentiment` | `positive` \| `negative` \| `neutral` |
| `included_in_piece` | Boolean — used in generated piece |
| `likes_count` | Engagement signal — more-liked comments carry more weight |
| `fetched_at` | Timestamp |

#### Comment polling schedule
- Fetch comments at: 2 hours, 6 hours, and 24 hours after posting — captures the initial rush and the slower tail
- De-duplicate by `platform_comment_id` — safe to re-poll without creating duplicates
- Filter out: very short comments (<5 words), obvious spam patterns, comments that are just emojis
- Respect API rate limits: Facebook allows ~200 calls/hour per token

#### Generation trigger
Same as the WhatsApp reaction piece system — manual trigger from admin OR auto-trigger when 10+ safety-passed comments exist:
- AI receives: original article + all approved comments + sentiment breakdown + engagement counts
- Prompt instructs it to weight higher-liked comments more heavily as they represent broader agreement
- Never attribute specific views to named commenters — "One local resident commented…", "Several people pointed out…"
- Link back to the Facebook/Instagram post so readers can join the discussion

#### Privacy considerations
- Facebook commenter names are public (unlike WhatsApp) but should still NOT be published in generated pieces — editorial standards
- Store names in DB for admin reference only (helps spot spam patterns)
- Do not store profile pictures or profile links — unnecessary PII
- GDPR: comments are publicly posted by users on a public post — no additional consent required for editorial analysis, but generated pieces should not identify individuals

#### Admin controls needed
- Article detail: show comment count by platform, sentiment breakdown, list of fetched comments with safety/sentiment status
- "Fetch latest comments" manual refresh button
- "Generate reaction piece" button (same as WhatsApp reaction flow)
- Toggle per-article: "Monitor social comments" on/off

#### API permissions required
- Facebook: `pages_read_engagement`, `pages_manage_posts` — already needed for posting
- Instagram: `instagram_manage_comments` — additional permission on top of posting permissions
- No extra OAuth scopes for reading public post comments if the post was made by your own page

#### Relationship to WhatsApp reaction pieces
These are the same concept — community opinions synthesised into a companion piece. The two sources (WhatsApp hashtag replies + social media comments) can be merged into a single reaction piece if both exist, giving a richer cross-channel view of community opinion. The `article_reactions` table (WhatsApp) and `social_comments` table could be combined in the AI prompt for a single synthesis.

---

### Per-article AI cost display (Articles page & article detail)
- **What exists**: `ai_usage_log` table already records every OpenAI API call with token counts and USD cost, linked to each submission via `submission_id`. The AI Usage page shows platform-wide totals and breakdowns.
- **What's missing**: Individual article cards / article detail view don't show how much that specific article cost to generate.
- **Plan**:
  - Add a `GET /posts/:id/cost` endpoint (or include cost in the existing post response) that sums all `ai_usage_log` entries for the article's `source_submission_id`
  - Return total input tokens, output tokens, total cost USD, and a breakdown by stage (tone classify, info extract, write article, etc.)
  - Display a small cost badge on each article card in the Articles page (e.g. "$0.009")
  - Show a full cost breakdown in the article detail/edit view — which pipeline stages ran, what each cost, total spend
- **Join path**: `posts.source_submission_id` → `ai_usage_log.submission_id`
- **Note**: Articles processed before the usage tracking was added (the first 12) will show $0.00 — add a "legacy — no data" label for those rather than showing zero

---

### Newsletter system (WhatsApp + Email delivery)

#### Overview
A monthly newsletter compiled from the best articles of that month, delivered via WhatsApp (free, using the 24-hour reply window) and/or email. Subscribers manage their own delivery preference. Sign-up available on the public website and via WhatsApp replies.

#### Subscriber data model (`newsletter_subscribers` table)
| Column | Notes |
|---|---|
| `phone` | WhatsApp number — optional, required for WhatsApp delivery |
| `email` | Email address — optional, required for email delivery |
| `delivery_pref` | `whatsapp_only` \| `email_only` \| `both` \| `unsubscribed` |
| `source` | How they signed up: `website_form` \| `whatsapp_auto` \| `whatsapp_reply` |
| `confirmed_at` | Timestamp of first confirmed contact |
| `pref_updated_at` | Timestamp of last preference change |

#### Newsletter issues (`newsletters` table)
| Column | Notes |
|---|---|
| `month` | e.g. `2026-04` — unique, one per month |
| `title` | e.g. "April 2026 — Tallaght Community Newsletter" |
| `slug` | URL path, e.g. `/newsletter/april-2026` |
| `body_html` | Full rendered HTML for email delivery |
| `summary_text` | Short WhatsApp-friendly text summary (with link) |
| `status` | `draft` \| `published` |
| `published_at` | When it went live |
| `article_ids` | Array of post IDs included in this issue |

#### WhatsApp newsletter sends (`newsletter_wa_sends` table)
Tracks which phone numbers have already received the current month's newsletter via WhatsApp auto-reply, to avoid sending it twice.
| Column | Notes |
|---|---|
| `phone` | Recipient phone number |
| `newsletter_month` | e.g. `2026-04` |
| `sent_at` | Timestamp |

#### Website sign-up form
- Fields: **email** (required) + **phone number** (optional, labelled "Add your WhatsApp number for newsletter delivery")
- Email only → `email_only` preference
- Phone only → `whatsapp_only` preference
- Both → `both` preference
- Stores to `newsletter_subscribers` table; sends a confirmation reply/email immediately

#### WhatsApp auto-delivery (free — within 24-hour session window)
- When someone messages the WhatsApp number, the webhook checks: is there a published newsletter for this month, and has this number NOT already received it this month?
- If yes → append newsletter link and preference prompt to the submission acknowledgment reply: *"While you wait — here's our April newsletter: [link]. Reply EMAIL to switch to email, BOTH for both, or STOP to unsubscribe."*
- Mark the send in `newsletter_wa_sends` so it only happens once per number per month
- This is **free** — it is a reply within the customer-initiated 24-hour window, not an outbound template message

#### WhatsApp keyword detection (CRITICAL — must be pre-AI filter)
Before any message is routed to the AI pipeline, check for control keywords. These must short-circuit immediately and never reach OpenAI:
- `STOP` / `UNSUBSCRIBE` → mark subscriber as `unsubscribed`, reply confirmation
- `EMAIL` → prompt for email address; on next reply containing `@`, store email and set `email_only`
- `BOTH` → prompt for email address; on next reply containing `@`, store email and set `both`
- `WHATSAPP` → set `whatsapp_only`, reply confirmation
- A bare email address in a session where the bot is awaiting one → store it and confirm
- **Note**: This requires a per-number "conversation state" flag (e.g. `awaiting_email`) in the contributors or subscribers table

#### Email delivery
- External sending service required — **Resend** recommended (3,000 emails/month free tier, simple API, excellent deliverability)
- Monthly newsletter email: HTML email with top stories, images, and a "Read more on the website" CTA for each article
- From address: e.g. `hello@[yourdomain].ie` — requires verified domain in Resend
- Unsubscribe link in every email footer (legal requirement under GDPR)

#### Admin: newsletter generation & publishing
- New "Newsletter" section in admin dashboard
- "Generate [Month] newsletter" button → AI selects top articles from the past month (best by category, diversity of topics)
- Admin previews the selection, can add/remove articles, edit the intro paragraph
- "Publish" → creates the newsletter page on the public website and queues delivery
- Delivery queue: emails sent via Resend to all `email_only` and `both` subscribers; WhatsApp links queued for next-contact delivery to `whatsapp_only` and `both` subscribers
- Stats: how many delivered by channel, open rate (email), click rate

#### GDPR / compliance notes
- Every email must have a one-click unsubscribe link
- WhatsApp subscribers must have opted in (website form or explicit WhatsApp reply)
- Store consent source and timestamp
- Data deletion: admin should be able to delete a subscriber by phone/email on request

---

### Community reaction pieces ("Have Your Say" via WhatsApp hashtags)

#### Concept
When an article is published, it can be assigned a short reaction hashtag (e.g. `riot`, `watermain`, `busroute`). The social media post and/or article footer invites readers to WhatsApp their opinion using that tag: *"Have your say — WhatsApp us with #riot + your view."* Responses are collected for a set window, then the AI synthesises them into a companion "Community Reacts" article, which goes to the Review Queue for human approval before publishing.

#### How the hashtag routing works (WhatsApp webhook)
- Pre-AI filter: any incoming message whose text starts with `#` is treated as a reaction, not an article submission
- Extract the hashtag (e.g. `riot` from `#riot these lads are a disgrace`)
- Look up which published article has `reaction_hashtag = 'riot'`
- If found → store as a reaction record; do NOT route to the AI article pipeline
- If not found → treat as a normal submission (hashtag may be coincidental)
- Acknowledge the sender: *"Thanks — your view has been noted and may be included in a community response piece."*

#### Data model additions
**`posts` table — new columns:**
- `reaction_hashtag` — short tag admin assigns when publishing (e.g. `riot`). Unique. Null = reactions not enabled for this article.
- `reaction_piece_id` — FK to the generated companion post once it's created

**New `article_reactions` table:**
| Column | Notes |
|---|---|
| `id` | serial PK |
| `article_id` | FK → `posts.id` — the article this reaction belongs to |
| `phone` | Submitter's phone number (never shown publicly) |
| `hashtag` | The tag used (e.g. `riot`) |
| `raw_text` | Their message, with the hashtag stripped out |
| `safety_passed` | Boolean — individual moderation check result |
| `sentiment` | `positive` \| `negative` \| `neutral` — quick AI classify |
| `included_in_piece` | Boolean — whether this reaction was used in the generated piece |
| `created_at` | Timestamp |

#### Individual reaction processing
Each reaction runs through:
1. **Moderation check** (OpenAI Moderation API, free) — flag and exclude toxic/violating content
2. **Quick sentiment classify** (GPT-4o-mini, ~0.0001 per reaction) — tag as positive/negative/neutral for balance in the generated piece
3. Store result regardless — admin can see all reactions including flagged ones in the dashboard

#### Generation trigger
Two modes, both should exist:
- **Auto-trigger**: a scheduled job checks every hour for articles where: `reaction_hashtag IS NOT NULL` AND at least 5 reactions have passed safety AND the article was published more than X hours ago (configurable per article, default 4 hours). Queues a `GENERATE_REACTION_PIECE` job.
- **Manual trigger**: admin can click "Generate reaction piece" on any article in the dashboard at any time, regardless of threshold or timing.

#### AI generation — the reaction piece
The AI receives:
- The original article body
- All safety-passed reactions, with their sentiment labels
- A count breakdown: e.g. "12 reactions total: 4 positive, 6 negative, 2 neutral"

**System prompt (finalised):**
```
You are writing a community reaction article based on multiple anonymous responses from local residents.

STRICT RULES:
- Do NOT include names or identify any individual.
- Do NOT quote exact messages unless they are neutral and safe.
- Do NOT exaggerate or dramatise opinions.
- Do NOT introduce new facts.

STRUCTURE:
- Start with a simple summary of the situation.
- Then describe the overall sentiment (e.g. mostly negative, mixed, etc).
- Then give a balanced overview of the different views.
- Keep tone neutral and grounded.

STYLE:
- Write in simple, natural language.
- Avoid dramatic or sensational wording.
- Keep it readable and local in tone.

IMPORTANT:
- Reflect uncertainty if opinions are mixed.
- Do not claim "everyone thinks" anything.
- Use phrases like "some residents said…" or "others felt…"

OUTPUT:
- Article body only
```

Generated piece:
- Always goes to `held` status — never auto-published
- Tagged as a companion to the original article via `posts.reaction_piece_id`
- Appears in Review Queue with a "Community Reaction" badge
- Admin approves, edits if needed, then publishes

#### Admin dashboard additions needed
- Article edit/detail view: field to set `reaction_hashtag`, toggle to enable/disable reactions
- Reactions tab on each article: list of all received reactions with safety status, sentiment, phone (admin-only), and included/excluded flag
- "Generate reaction piece" button (manual trigger)
- Reaction piece count shown on article cards (e.g. "14 reactions")

#### Cost per reaction piece
- Moderation per reaction: free
- Sentiment classify per reaction: ~$0.0001 (GPT-4o-mini, tiny prompt)
- Reaction piece generation: ~$0.002–0.005 (GPT-4o-mini, short synthesis)
- A 20-reaction article costs roughly $0.005 total — negligible

#### Edge cases to handle
- **Duplicate reactions from same number**: allow (people may send multiple thoughts), store all, but flag if more than 3 from one number (possible spam)
- **No reactions after 24 hours**: auto-expire the hashtag, no piece generated
- **All reactions flagged by moderation**: do not generate a piece; notify admin
- **Hashtag clash**: enforce uniqueness in the DB; admin UI warns if tag is already in use

---

## Monetisation Plan

The platform has two natural revenue streams that can start generating income almost immediately, both without needing to build any self-serve infrastructure first. Everything in Phase 1 can be done manually while the platform grows.

---

### Stream 1 — Newsletter Sponsorship & Advertising

#### Concept
Each newsletter issue has a fixed number of paid slots. Businesses pay to appear in front of the subscriber list for that month. Price scales automatically with audience size — as the list grows, you raise prices, and the early sponsors who backed you at €30/month benefit from a price lock until they cancel.

#### Ad slot types (within a newsletter issue)
| Slot | What it is | Launch price | 1k subscribers | 2k+ subscribers |
|---|---|---|---|---|
| **Spot ad** | Small text block + logo, ~50 words, appears mid-newsletter | €30/month | €75/month | €150/month |
| **Section sponsor** | "Sport this week is brought to you by X" — logo + one line at the top of a category section | €60/month | €125/month | €250/month |
| **Issue sponsor** | "This month's Tallaght Community newsletter is presented by X" — top and bottom of full issue, 150-word editorial piece about the business, logo throughout | €120/month | €250/month | €500/month |

- Maximum 2 paid slots per issue to maintain editorial quality and reader trust
- Slots for the next issue become available after the current one sends
- Long-term sponsors (paying 3+ months consecutively) get a 10% loyalty discount — rewards commitment and reduces churn

#### Selling it (Phase 1 — no self-serve portal needed)
- Reach out to local businesses by WhatsApp or phone — Tallaght is a community, direct is better
- Send them the stats (subscriber count, open rate, WhatsApp delivery rate) as social proof
- Collect payment via bank transfer or Revolut to start; move to Stripe when volumes justify it
- Track bookings in a simple spreadsheet: business name, slot type, issue, paid/unpaid, renewal date
- Give them a simple brief form (Google Form is fine) — they fill in: business name, tagline, offer (if any), logo image, contact details

#### Admin tools needed (Phase 2)
- Newsletter issue builder needs "ad slots" section — assign a booked business to Spot/Section/Sponsor position for that issue
- The newsletter template automatically places their content at the correct position
- Admin dashboard: "Sponsorship" page — list of all bookings, status (paid/unpaid/upcoming/expired), renewal alerts

#### Stripe integration (Phase 3)
- Monthly recurring subscriptions per slot type
- Business receives invoice email automatically
- Admin gets notified when a subscription cancels (slot becomes available)
- Self-serve: business can log in to update their ad copy/logo before each issue

---

### Stream 2 — Business Listings & Featured Content

This is where it gets interesting, because there are several models and it's worth understanding the tradeoffs before committing to one. The right choice depends on whether the priority is volume of businesses or revenue per business.

#### Option A — AI-Written Business Feature Articles (recommended for early stage)
A business pays for a professionally written article about them, placed permanently on the platform. The AI writes it from a brief they fill in (what the business does, their story, any current offer or news). It gets published just like any other article but labeled "Sponsored Content" or "Business Feature".

**Why this works well for Tallaght:**
- Local businesses can't afford a PR agency. A permanent, well-written article on a well-indexed local website is genuinely valuable — it helps their Google ranking for local searches
- One-time cost means no ongoing commitment to scare them off
- Low delivery overhead — AI writes the draft, admin reviews, publishes
- Permanent benefit — unlike an ad that disappears, the article stays forever and keeps generating SEO value

**Pricing:**
- €75–150 per article (launch price €75, raise to €100+ as traffic grows)
- Optional add-on: newsletter mention in the same month's issue (€30 — cheaper than standalone spot ad)

**How the brief works:**
- Business fills in a simple WhatsApp/form submission with: business name, what they do, their story, any special offer or news angle
- This goes into the standard WhatsApp pipeline but is flagged as a paid submission
- AI writes a 400-word editorial-style piece (same pipeline, but with a "business feature" system prompt variant that focuses on what makes the business unique to Tallaght)
- Admin reviews and publishes — or sends the draft to the business for approval first

#### Option B — Enhanced Business Directory Listings
A permanent directory page on the website for each business, like a mini profile.

| Tier | What's included | Price |
|---|---|---|
| **Free basic** | Name, category, phone, website link — automatically indexed if mentioned in an article | Free |
| **Enhanced** (€12/month or €120/year) | Business photo, opening hours, short description, "Verified Local Business" badge, priority in directory search |
| **Featured** (€30/month or €300/year) | Everything in Enhanced + prominent placement at top of category, mentioned in relevant newsletter sections, linked from related editorial articles |

**Tradeoff**: A directory needs traffic before businesses will pay for enhanced listings. Works better in 6–12 months when the site is established than at launch.

#### Option C — Category Sponsorship (hybrid approach)
A business sponsors an entire content category on the website for a month. Their name/logo appears on every article in that category during the sponsorship period.

Examples:
- A local gym sponsors the "Sport" category — "*Sport coverage this month supported by [Gym]*"
- A solicitor sponsors "News & Issues" — "*News coverage supported by [Solicitor]*"
- A restaurant sponsors "Events & What's On"

**Why this is easy to sell**: The pitch is simple and tangible. "Your logo appears on every sport article we publish this month." No confusion about what they're getting.

**Pricing**: €80–200/month depending on category traffic. Sport and News likely command the highest rates.

**Technical need**: A `sponsors` field on the categories table — admin assigns a monthly sponsor to a category. Article templates check if the category has a current sponsor and render the line if so.

---

### Recommended rollout order

**Right now (no code needed):**
1. Start selling newsletter spots for the first newsletter issue manually
2. Offer AI Business Feature articles to a handful of local businesses at €75 launch price — this funds itself almost immediately (2 articles = €150, covers OpenAI costs for months)
3. Reach out via WhatsApp to local businesses — Tallaght GAA sponsors, local gyms, solicitors, estate agents — these are the most likely early buyers

**Phase 2 (after first 3 months):**
4. Build newsletter ad slot management into admin
5. Add "Sponsored Content" article type with proper labeling in admin
6. Add simple billing records page to admin (manual payment tracking)

**Phase 3 (when list hits 500+ subscribers):**
7. Stripe integration for newsletter recurring subscriptions
8. Business directory with enhanced/featured tiers
9. Category sponsorship system

---

### Important note on editorial integrity
Sponsored content must be clearly labeled — "Sponsored Content", "Business Feature", or "Supported by [X]" depending on the format. This protects the editorial credibility of the platform which is its most valuable long-term asset. Community trust is worth more than any individual ad deal.

---

### Entity Library (organisation & person image store)

#### Concept
A database of named entities — local organisations, people, venues, clubs, and recurring figures — each with a stored image (logo, headshot, team crest). When the AI writes an article, it checks whether any known entities are mentioned and automatically uses the matching image as the header image if no photo was submitted with the original message.

#### How it works end to end
1. A contributor sends a photo of the Tallaght Rehabilitation logo with a caption like *"Tallaght Rehabilitation are hosting an open day."*
2. The image classifier detects it is a logo/branding asset (not a scene or event photo) and the admin is prompted: *"Save this as an entity image for Tallaght Rehabilitation?"*
3. The entity record is created: name, aliases, type, stored image URL
4. Future: any submission mentioning "Tallaght Rehabilitation" (or any alias) — even with no image — gets the stored logo as its header image automatically
5. If a submission includes both an event photo and the entity is matched, the submitted photo takes priority (scenes trump logos)

#### Entity record structure (`entities` table)
| Column | Notes |
|---|---|
| `id` | serial PK |
| `name` | Primary name (e.g. "Tallaght Rehabilitation") |
| `aliases` | JSON array of alternate names (e.g. ["Tallaght Rehab", "TR"]) |
| `type` | `organisation` \| `person` \| `venue` \| `team` \| `event` |
| `imageUrl` | Stored image path (Object Storage) |
| `website` | Optional |
| `description` | Short summary (used as AI context when entity is matched) |
| `createdAt` | Timestamp |

#### AI matching step
After article writing, the AI receives the entity list and the article body and returns any entities it finds mentioned. Confidence threshold applies — low-confidence matches do not override submitted images.

#### Image precedence rules
1. Submitted event/scene photo — always first choice
2. Entity match — used when no photo submitted, or when submitted image is itself a logo
3. DALL·E generated image — fallback if no entity match and no submitted image
4. No image — last resort

#### Monetisation angle
Businesses with paid listings (Option A/B/C) get their logo/image stored as an entity — meaning every editorial article that mentions their business automatically uses their brand image. This is a tangible premium benefit that can be included in paid packages.

#### Admin controls needed
- Entity Library page in admin — list, add, edit, delete entities
- On article detail: show which entity was matched (if any) and allow override
- Image upload for entity logos directly in admin (no need to send via WhatsApp)
- Alias management — "also known as" field for fuzzy matching

---

### Multi-image grouping (WhatsApp)

#### The problem
When a contributor sends two or more images at the same time in WhatsApp, each image arrives as a separate webhook event — milliseconds apart but with no shared identifier. The system currently treats each one as an independent submission and creates a separate article per image.

#### Recommended approach: time-window + album detection (two layers)

**Layer 1 — WhatsApp album metadata:**
When a contributor uses WhatsApp's native multi-select (tap and hold to select multiple photos before sending), Meta's webhook includes a shared `context` field on each message linking them to the same album. If this field is present and matches a previous message, they are definitively the same submission. No delay required.

**Layer 2 — Time-window grouping (fallback):**
When images arrive individually (not as an album), the system holds each message in a pending state for 10 seconds before processing begins. Any additional message arriving from the same phone number within that window is merged into the same submission. After the window closes with no further messages, processing starts on the combined group.

#### How grouping changes the pipeline
- The submission record gains a `mediaItems` array (instead of a single image)
- The image description stage describes all images and produces a combined summary
- The AI article writer receives all descriptions and any caption text to produce one article
- The first image (or best compositional image, per AI ranking) becomes the header image
- Remaining images are stored and associated with the article for potential gallery display

#### Precedence for caption text
When multiple images are sent, the caption typically only appears on the first image. The pipeline should collect captions from all messages in the group and join them as the primary text source.

#### Photo gallery on the website
Once multi-image grouping works, an article can display a full photo gallery — multiple images stored and shown as a slideshow or grid on the article page. This is a significant quality upgrade for event coverage (e.g. 5 photos from a football match → one rich article with a gallery, not five thin articles).

#### Admin controls needed
- Merge tool: select two articles and ask the AI to combine them into one (for cases where automatic grouping missed it)
- Article detail: show all images associated with the article, reorder them, set which is the header
- Review Queue: "Combined submission" badge showing how many images were grouped

#### Edge cases
- Someone sends an image now and another image two hours later about a completely different topic — the 10-second window prevents false grouping
- All images in a group fail the safety check — treat same as single rejected submission
- Caption on second image but not first — still collected and used

---

### Video upload handling (WhatsApp pipeline)
- **Rule**: Any WhatsApp submission containing a video file must always be routed to `held` status — no auto-publish regardless of confidence score.
- **AI assessment approach**:
  - Extract the audio track from the video and transcribe with Whisper (same as voice notes)
  - Extract a sample of key frames (e.g. one every 5 seconds) and describe each with GPT-4o Vision
  - Combine transcript + frame descriptions into a written AI assessment stored on the submission record
- **Review Queue**: Show a "Contains video" badge on video submissions; display the AI assessment note so editors know what the video contains before approving or rejecting — without needing to watch it first
- **Tooling note**: Will require `ffmpeg` to extract audio and frames from the video buffer before passing to OpenAI

### AI Clarification Loop (WhatsApp pipeline)

#### Concept
After the AI extracts key facts from a submission (Stage 5), before writing the article it checks whether anything needs confirming with the contributor. If so, it sends a WhatsApp question and waits for the reply before proceeding to Stage 6. One question at a time, one reply needed.

#### What triggers a clarification question
- **Name detected in submission** — AI asks: "We noticed the name [Name] in your message — is that your own name, or someone else's? Reply MY NAME or SOMEONE ELSE." If confirmed as their own: "Would you like to be named in the article, or stay anonymous? Reply NAMED or ANONYMOUS."
- **Vague location** — e.g. "up the road", "near the shops" → AI asks: "Where exactly did this happen? (e.g. Old Bawn Road, Tallaght Town Centre)"
- **Vague time** — e.g. "yesterday", "earlier" → AI asks: "When did this happen? Reply with a date or day."
- **Very short/incomplete submission** — AI asks: "Can you tell us a bit more about what happened?"
- **Unverified claim** — e.g. "I heard that…" → AI asks: "Do you have any more details or do you know who said this?"

#### Data model additions
**New `submission_clarifications` table:**
- `id` — serial primary key
- `submission_id` — FK to submissions
- `contributor_id` — FK to contributors (for fast webhook lookup)
- `question_type` — enum: `name_attribution` | `location` | `date` | `detail` | `custom`
- `question_text` — the exact message sent to the contributor
- `status` — enum: `pending` | `answered` | `timed_out`
- `answer` — text, the contributor's reply
- `asked_at` — timestamp
- `answered_at` — timestamp (nullable)

**Submissions table — new `pending_clarification` status** added to `submissionStatusEnum`.

#### Webhook changes
When a consented contributor sends a message, check first if they have an open (`pending`) clarification record. If yes, their reply is treated as the answer (not a new submission):
1. Store the reply as `answer` on the clarification record, mark `answered`
2. Check if there are more pending clarifications for the same submission
3. If no more → update submission status back to `pending`, re-queue for Stage 6 with all clarification answers injected into the context
4. If more → send the next question

#### AI pipeline changes
- After Stage 5 (info extraction), a new **Stage 5b** generates clarification questions if needed
- Returns a structured list: `[{ type, question }]` — empty array if no clarifications needed
- If questions exist: insert rows into `submission_clarifications`, set submission status to `pending_clarification`, send first question via WhatsApp
- Stage 6 prompt receives a `clarifications` block: "Contributor confirmed: name is their own, prefers to stay anonymous. Location confirmed: Rossfield Estate."

#### Timeout handling
- A background job checks for clarifications where `asked_at` is older than 24 hours and status is still `pending`
- On timeout: mark as `timed_out`, check if remaining questions can be skipped, re-queue submission for Stage 6 without the clarification
- Contributor receives: "No worries — we'll process your story with the information you gave us."

#### Name attribution — editorial priority
The name question should always fire if a name is detected, regardless of anything else. Publishing someone's name without explicit consent is the highest-risk outcome; this is the one clarification that should never be skipped or timed out silently.

---

### Admin WhatsApp Trigger Phrases (owner-submitted tasks)

#### The problem
The platform owner needs a way to submit instructions to the AI pipeline via WhatsApp — not as a public contribution, but as an internal task. For example: "Write an announcement article introducing the new Lost & Found section." This is fundamentally different from a community submission and needs to be routed separately.

#### Concept: admin trigger phrases
- The admin's phone number(s) are registered in Settings as `admin_whatsapp_numbers` (comma-separated list of hashed numbers, or stored plaintext since it's the owner's own number)
- Any message from a registered admin number that begins with a trigger prefix is treated as an **admin task**, not a public submission
- Suggested prefixes (configurable in settings): `TASK:`, `ANNOUNCE:`, `WRITE:`, `PUBLISH:`
- Non-prefixed messages from admin numbers still go through the normal contributor pipeline (admin may also be a regular contributor)

#### How admin tasks differ from submissions
| | Contributor submission | Admin task |
|---|---|---|
| Source | Community member | Platform owner |
| Pipeline | Full AI pipeline (Stage 1–7) | Simplified — skips moderation, goes straight to article writing |
| Default routing | Confidence-based (auto-publish or hold) | Always goes to Review Queue — admin still approves before publishing |
| Consent gate | Required | Skipped (owner is operating the platform) |
| Attribution | "A local resident" | Can be set to "Editorial" or "Tallaght Community Hub" |

#### Example usage
Admin sends via WhatsApp:
> `ANNOUNCE: We've just launched a new Lost & Found section. People can now submit found or lost items via WhatsApp and we'll publish them here. Encourage neighbours to use it.`

The system:
1. Detects the `ANNOUNCE:` prefix and admin number match
2. Skips consent/moderation — goes straight to a tailored AI article prompt
3. AI writes a short community announcement article
4. Lands in Review Queue with an "Admin task" badge for final approval
5. Admin publishes it — it goes live like any other article

#### Settings needed
- `admin_whatsapp_numbers` — list of hashed phone numbers that get admin routing
- `admin_task_prefixes` — comma-separated list of recognised prefixes (default: `TASK:,ANNOUNCE:,WRITE:,PUBLISH:`)

#### Article attribution for admin tasks
- Byline: "Tallaght Community Hub" (not "a local resident")
- Category: admin selects in Review Queue before publishing (or can be detected from the instruction)

---

### Lost & Found — Listing Mode (category-specific submission type)

#### Concept
Lost & Found is fundamentally different from a news article. It's a structured short listing — a brief description, a photo if available, a location, and a way to get in touch. The full AI article pipeline (300-word articles) is the wrong format. Lost & Found needs a **listing mode**: short, structured, card-based output.

Crucially, **the public never needs to use a prefix or keyword**. Someone just sends a natural message — "I lost me dog, it's a black lab, if anyone sees it please get in touch" — and the AI detects that this is a lost/found submission from the content itself.

#### How the AI detects lost/found submissions
Stage 4 (tone classification) is extended with a new classification type: `lost_and_found`. The AI looks for natural language signals:
- "I lost...", "has anyone seen...", "missing since...", "can't find..."
- "I found...", "found a...", "handed in...", "nobody claimed..."
- Mentions of pets, keys, wallets, phones, bags, bikes
- An appeal for contact ("please get in touch", "if you see her")

If the classification returns `lost_and_found`, the submission bypasses the standard Stage 6 article prompt and uses the listing mode prompt instead.

#### Contact consent — the follow-up question (links to AI Clarification Loop)
After detecting a lost/found submission, before writing anything, the system sends one clarification question via WhatsApp:

> "Will we share your WhatsApp number with anyone who says they've found it? Reply YES or NO."

- **YES** → the published listing includes: "To get in touch, WhatsApp [platform number] and we'll connect you."  The contributor's number is stored privately on the listing record so admin can pass it on when someone responds.
- **NO** → the published listing says: "If you have information, WhatsApp [platform number] and we'll pass on the message." Contact is always mediated through the platform.

This question is treated as a clarification record (same `submission_clarifications` table as the AI Clarification Loop). The listing is not published until the contributor replies, or until 24 hours pass (in which case it defaults to NO — never share without explicit consent).

#### What the AI does differently in listing mode
- Does NOT write a 300-word article — target is 2–4 sentences max
- Does NOT invent detail — only uses what was given
- Fills in gaps naturally: if no date, uses "recently"; if no location, omits it rather than guessing
- Strips raw phone numbers or personal addresses from the published text
- Always goes to Review Queue — no auto-publish for lost/found listings

#### Category routing
- `lost_and_found` classification → automatically assigned to the Lost & Found category
- Skips tone scoring and topic extraction — listing type is already established
- Review Queue shows a "Lost & Found" badge and displays whether the contributor consented to number sharing

#### Natural resolution — no commands needed
When the contributor who submitted the original lost/found listing sends a follow-up message, the AI checks whether it sounds like a resolution:
- "We found her!", "She's home safe", "Got him back", "Keys turned up", "Someone handed it in"
- Natural positive language after a period of a live lost/found listing

**How the link is made:**
The system looks up the contributor's most recent active (unresolved) lost/found listing by their phone hash. If one exists and the new message reads as a resolution, it is treated as a resolution update — not a new submission.

**What happens:**
1. The listing is automatically marked as **Resolved** in the database
2. The listing card on the website updates to show "✓ Reunited" or "✓ Claimed"
3. The contributor receives a warm reply: "Delighted to hear that! We've updated your listing. 🐾" (tone adjusted for pets vs objects)
4. No admin action required — the resolution is instant

**Ambiguity handling:**
If the AI isn't confident the message is a resolution (e.g. it could be a new submission unrelated to the listing), it asks:
> "Great news! Does this mean [dog/item description] has been found? Reply YES to close your listing or NO if this is something else."

**Edge cases:**
- If the contributor has no active listing → treated as a normal submission
- If the contributor has multiple active listings → AI asks which one: "Is this about your lost [description]? Reply YES or NO."
- Resolution messages are never published as new articles

#### Website display
- Lost & Found category page shows cards, not article previews
- Each card: photo (if any) + short listing text + "Lost" or "Found" badge + date posted
- Cards expire (archived, not deleted) after 30 days, or when admin marks as "Resolved"
- "Resolved" cards show a ✓ Reunited or ✓ Claimed label — positive community signal
- Resolved cards stay visible for 7 days then archive — gives the community the feel-good moment before it disappears

#### Introducing the section — link to Admin Trigger Phrases
The admin would use the `ANNOUNCE:` trigger (see above) to write and publish an introductory article explaining the new section — written by the AI in the platform's editorial voice, published under "Tallaght Community Hub". This is the connection between the two features.

---

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
