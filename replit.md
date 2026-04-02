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
