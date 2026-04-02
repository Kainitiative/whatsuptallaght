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
- Recognises commands (HELP, MY POSTS, STATUS, DELETE, STOP) and routes them to the command handler

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

Prompt instructs it to:
- Write a 200–400 word companion piece headlined *"Community Reacts: [Original Headline]"* or *"In Their Own Words: [Topic]"*
- Present a balanced synthesis of views — do not cherry-pick only one sentiment
- Never quote anyone by name or attribute specific views to identifiable individuals — use *"one resident said"*, *"several people expressed"*, *"others pointed out"*
- Reference the number of responses received: *"More than a dozen Tallaght residents shared their views…"*
- Link the piece back to the original article

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

### Video upload handling (WhatsApp pipeline)
- **Rule**: Any WhatsApp submission containing a video file must always be routed to `held` status — no auto-publish regardless of confidence score.
- **AI assessment approach**:
  - Extract the audio track from the video and transcribe with Whisper (same as voice notes)
  - Extract a sample of key frames (e.g. one every 5 seconds) and describe each with GPT-4o Vision
  - Combine transcript + frame descriptions into a written AI assessment stored on the submission record
- **Review Queue**: Show a "Contains video" badge on video submissions; display the AI assessment note so editors know what the video contains before approving or rejecting — without needing to watch it first
- **Tooling note**: Will require `ffmpeg` to extract audio and frames from the video buffer before passing to OpenAI

---

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
