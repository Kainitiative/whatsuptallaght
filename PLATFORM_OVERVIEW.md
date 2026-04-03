# Tallaght Community Platform — Full Overview

> Last updated: April 2026

---

## 1. What This Platform Is

A **WhatsApp-first, AI-powered local news and community information hub** for Tallaght, Dublin. Community members submit stories, photos, events, and local news via WhatsApp — no accounts, no forms, no app required. The AI processes every submission into a professionally written article that is published on a public-facing website. An admin dashboard gives the operator full editorial control.

The platform has three main parts:

| Part | URL | Purpose |
|---|---|---|
| Public website | `/` | Community-facing — articles, events, contributor profiles |
| Admin dashboard | `/admin/` | Operator — review queue, settings, analytics |
| API server | `/api/` | Backend powering both frontends + WhatsApp webhook |

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 / Node.js 24 |
| API framework | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React + Vite |
| Validation | Zod v4 + drizzle-zod |
| AI | OpenAI (GPT-4o, GPT-4o-mini, Whisper, Moderation) |
| Image storage | Replit Object Storage (Google Cloud Storage) |
| WhatsApp | Meta Cloud API (WhatsApp Business) |
| RSS | rss-parser (Node) |

---

## 3. Monorepo Structure

```
workspace/
├── artifacts/
│   ├── api-server/          Express API — all routes, AI pipeline, queue
│   ├── community-website/   Public React/Vite frontend
│   └── admin-dashboard/     Admin React/Vite frontend
├── lib/
│   ├── db/                  Drizzle schema + PostgreSQL connection
│   ├── api-spec/            OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/    Generated React Query hooks
│   └── api-zod/             Generated Zod schemas
└── scripts/                 Utility scripts (seed, migrations)
```

---

## 4. Database Schema

All tables live in PostgreSQL, managed via Drizzle ORM. Schema files: `lib/db/src/schema/`

### `contributors`
Stores every unique WhatsApp sender (never stores raw phone numbers).

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `phoneHash` | varchar | SHA-256 of `tallaght:{phone}` — irreversible |
| `phoneNumber` | varchar | Stored only after GDPR consent given |
| `displayName` | varchar | From WhatsApp profile |
| `consentStatus` | enum | `pending` / `consented` / `declined` |
| `consentGivenAt` | timestamp | When they replied YES |
| `isBanned` | boolean | Banned contributors are silently ignored |
| `publishedCount` | integer | Articles published from this contributor |
| `createdAt` | timestamp | |

### `submissions`
Every raw message received via WhatsApp.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `contributorId` | FK → contributors | |
| `rawText` | text | Original message text |
| `mediaUrl` | varchar | Object storage path if image/audio attached |
| `mediaType` | varchar | `image` / `audio` / `video` |
| `status` | enum | `awaiting_consent` / `pending` / `processing` / `published` / `held` / `rejected` / `failed` |
| `rejectionReason` | text | If rejected |
| `createdAt` | timestamp | |

### `posts`
Published (and draft/held) articles.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `slug` | varchar | URL slug, e.g. `luas-red-line-closure` |
| `headline` | varchar | Article headline |
| `body` | text | Full article body (HTML) |
| `categoryId` | FK → categories | |
| `headerImageUrl` | varchar | Object storage path |
| `status` | enum | `draft` / `published` / `archived` |
| `confidenceScore` | numeric | AI confidence (0–1) |
| `sourceSubmissionId` | FK → submissions | Originating WhatsApp/RSS submission |
| `publishedAt` | timestamp | |
| `createdAt` | timestamp | |

### `categories`
Article categories.

| Column | Notes |
|---|---|
| `id`, `name`, `slug` | e.g. "News & Issues" / `news-and-issues` |
| `description` | Short category description |
| `isActive` | Boolean |

Active categories: **Business & Local Services**, **Community & Notices**, **Events & What's On**, **News & Issues**, **Sport**

### `settings`
Encrypted key-value store for operator credentials and toggles.

| Key | Purpose |
|---|---|
| `openai_api_key` | OpenAI API access |
| `whatsapp_access_token` | Meta Cloud API token |
| `whatsapp_phone_number_id` | Meta phone number ID |
| `whatsapp_webhook_verify_token` | Webhook verification token |
| `whatsapp_app_secret` | HMAC signature validation |
| `platform_whatsapp_display_number` | Displayed on website QR section |
| `admin_password` | Admin dashboard login |
| `auto_publish_confidence_threshold` | Default 0.75 |

### `rss_feeds`
RSS feed sources for automated ingestion.

| Column | Notes |
|---|---|
| `url` | Feed URL |
| `name` | Display name |
| `trustLevel` | `official` / `news` / `general` |
| `checkIntervalMinutes` | How often to poll |
| `isActive` | On/off |
| `lastFetchedAt` | Last successful fetch |

### `rss_items`
Every item ever seen from RSS feeds (deduplication by GUID).

| Column | Notes |
|---|---|
| `guid` | Feed item GUID (unique) |
| `feedId` | FK → rss_feeds |
| `title` / `content` | Raw feed item |
| `isRelevant` | Passed the Tallaght geo-filter |
| `postId` | FK → posts (set when article created) |

### `job_queue`
Async processing queue for AI pipeline jobs.

| Column | Notes |
|---|---|
| `jobType` | `PROCESS_WHATSAPP_SUBMISSION` / `PROCESS_RSS_SUBMISSION` |
| `payload` | JSON — submissionId, rssItemId etc. |
| `status` | `pending` / `processing` / `completed` / `failed` |
| `attempts` | Retry counter |
| `nextRunAt` | Retry scheduling |

### `ai_usage_log`
Every OpenAI API call with cost tracking.

| Column | Notes |
|---|---|
| `submissionId` | FK → submissions |
| `stage` | e.g. `tone_classification`, `article_writing` |
| `model` | e.g. `gpt-4o`, `gpt-4o-mini` |
| `inputTokens` / `outputTokens` | Token counts |
| `costUsd` | Calculated cost |

### `golden_examples`
Human-approved article examples used for few-shot AI prompting.

| Column | Notes |
|---|---|
| `originalText` | The raw WhatsApp submission |
| `articleOutput` | The ideal article the AI should produce |
| `categoryId` | FK → categories |
| `isActive` | Whether to include in prompts |

### `distribution` (planned usage)
Tracks where articles have been shared (social platforms).

---

## 5. API Server

All routes are under `/api/`. Source: `artifacts/api-server/src/routes/`

### Public routes (`/api/public/`)
No authentication required.

| Route | Purpose |
|---|---|
| `GET /api/public/posts` | All published articles (paginated, filterable by category) |
| `GET /api/public/posts/:slug` | Single article by slug |
| `GET /api/public/categories` | All active categories |
| `GET /api/public/contributors` | All consented contributors (anonymised) |
| `GET /api/public/stats` | Site-wide stats (article count, contributor count) |
| `GET /api/public/config` | Platform config (WhatsApp display number, platform name) |

### Admin routes (`/api/admin/`)
All require `Authorization: Bearer <admin_password>` header.

| Route | Purpose |
|---|---|
| `GET /api/admin/posts` | All articles (any status) |
| `PATCH /api/admin/posts/:id` | Edit article / change status (publish, hold, archive) |
| `DELETE /api/admin/posts/:id` | Delete article |
| `GET /api/admin/submissions` | All submissions |
| `GET /api/admin/contributors` | All contributors |
| `PATCH /api/admin/contributors/:id` | Edit contributor (ban, update name) |
| `GET /api/admin/settings` | All settings (values masked) |
| `PUT /api/admin/settings/:key` | Update a setting |
| `GET /api/admin/stats` | Dashboard stats |
| `GET /api/admin/usage` | AI usage log |
| `GET /api/admin/rss-feeds` | All RSS feeds |
| `POST /api/admin/rss-feeds` | Add new feed |
| `PATCH /api/admin/rss-feeds/:id` | Edit feed |
| `DELETE /api/admin/rss-feeds/:id` | Remove feed |
| `GET /api/admin/golden-examples` | All golden examples |
| `POST /api/admin/golden-examples` | Add new example |
| `DELETE /api/admin/golden-examples/:id` | Remove example |
| `GET /api/admin/queue` | Job queue status |

### Webhook routes
| Route | Purpose |
|---|---|
| `GET /api/webhooks/whatsapp` | Meta webhook verification handshake |
| `POST /api/webhooks/whatsapp` | Incoming WhatsApp messages |

### Storage routes
| Route | Purpose |
|---|---|
| `GET /api/storage/objects/*` | Serve images from Object Storage |
| `POST /api/storage/objects` | Upload image (admin only) |

---

## 6. WhatsApp Integration

### Overview
The platform uses the **Meta Cloud API** for WhatsApp Business messaging. All communication with contributors happens through a single WhatsApp number. Contributors never need to download anything or create an account.

### Incoming message flow

```
Contributor sends WhatsApp message
         ↓
POST /api/webhooks/whatsapp
         ↓
1. HMAC-SHA256 signature verified (if app_secret configured)
2. Phone number hashed → SHA-256
3. Contributor upserted (created if new)
4. isBanned? → silent discard
         ↓
5. STOP/HELP commands? → handled immediately, no AI
         ↓
6. GDPR consent check:
   - pending  → hold submission, send consent request message
   - declined → remind they can reply YES to consent
   - consented → proceed to queue
         ↓
7. Submission created in database
8. Job queued → PROCESS_WHATSAPP_SUBMISSION
9. Acknowledgment sent: "👍 Got it! We'll review your message shortly."
```

### GDPR Consent Flow

```
New contributor sends first message
         ↓
Submission status: awaiting_consent
Consent message sent:
  "Before we can use your submission, we need your consent.
   Reply YES to agree to our Terms & Privacy Policy [link].
   Reply NO to decline."
         ↓
   YES → consentStatus = consented
          consentGivenAt = now
          phoneNumber = stored
          All awaiting_consent submissions re-queued → AI pipeline
          Confirmation message sent

   NO  → consentStatus = declined
          Submission discarded
          Confirmation message sent

   Future messages from declined contributor:
          Reminded they can reply YES at any time
```

### Supported WhatsApp commands (no AI processing)

| Command | Response |
|---|---|
| `STOP` | Marks contributor inactive, no further messages |
| `HELP` | Lists available commands |
| `MY POSTS` | Lists their published article headlines |
| `STATUS` | Status of their latest submission |
| `DELETE` | Requests deletion of their last submission |

### Outbound notifications
- **Consent request** — on first message from new contributor
- **Acknowledgment** — immediately on receiving any submission
- **Processing complete** — when AI finishes: published / held / rejected + reason
- **Article live** — when an article is published (including manual publish from admin), contributor receives a direct link to share

---

## 7. AI Pipeline

### Overview
Every qualifying WhatsApp submission passes through a 7-stage pipeline. Each stage is logged to `ai_usage_log` with token counts and USD cost.

```
Submission queued
      ↓
Stage 1: OpenAI Moderation (free API)
      ↓ fail → reject + ban contributor
Stage 2: Whisper transcription (audio only)
      ↓
Stage 3: GPT-4o Vision analysis (image only)
      ↓
Stage 4: Tone classification (GPT-4o-mini)
      ↓
Stage 5: Information extraction (GPT-4o-mini)
      ↓
Stage 6: Article writing (GPT-4o)
      ↓
Stage 7: Confidence routing
      ↓
  ≥ 0.75 → auto-publish → contributor notified
  0.40–0.74 → held in Review Queue
  < 0.40 → rejected → contributor notified
```

### Stage detail

**Stage 1 — Moderation**
- Uses OpenAI's free Moderation API
- Checks for: hate speech, harassment, self-harm, violence, sexual content
- Failure: submission rejected, contributor banned, message sent

**Stage 2 — Audio Transcription**
- Triggered only when submission includes an audio message (voice note)
- Uses Whisper (`whisper-1`)
- Transcribed text used as `rawText` for all subsequent stages

**Stage 3 — Image Analysis**
- Triggered only when submission includes an image
- Uses GPT-4o Vision
- Describes what is in the image; description added to context for article writing
- Image uploaded to Object Storage and stored as `headerImageUrl`

**Stage 4 — Tone Classification**
- Uses GPT-4o-mini with JSON mode
- Outputs: `tone` (`factual` / `opinion` / `announcement` / `sport` / `event`), `urgency` (1–5), `sentiment` (`positive` / `neutral` / `negative`)
- Tone influences article writing style in Stage 6

**Stage 5 — Information Extraction**
- Uses GPT-4o-mini with JSON mode
- Extracts: `headline`, `location`, `eventDate`, `keyFacts[]`, `completenessScore` (0–1)
- `completenessScore` used alongside confidence in routing decision

**Stage 6 — Article Writing**
- Uses GPT-4o (full model for quality)
- Receives: raw text, tone, extracted facts, image description (if any), category context
- **Few-shot prompting**: includes 2–3 Golden Examples from the same category for style guidance
- Outputs: full article body in journalistic style (3–5 paragraphs), suggested slug, suggested category

**Stage 7 — Confidence Routing**
- Combined score from: completeness, tone confidence, extraction confidence
- `≥ 0.75` → auto-published (configurable threshold in Settings)
- `0.40–0.74` → held in Review Queue for admin review
- `< 0.40` → rejected; WhatsApp notification sent with reason

### RSS Pipeline
A lighter version of the same pipeline, used for RSS-sourced articles:
- Skips Stages 1–3 (no moderation, no audio, no image — content already structured)
- Uses GPT-4o-mini for article rewriting (cheaper — content is already formatted)
- Trust-level routing: `official` feeds auto-publish at ≥ 0.75; `news` and `general` feeds always go to Review Queue

### Queue Worker
- Polls `job_queue` table every 5 seconds
- Atomic job claiming via `SELECT FOR UPDATE SKIP LOCKED` (prevents race conditions)
- Retry schedule: 60 seconds → 5 minutes → 15 minutes → permanent failure
- Job types: `PROCESS_WHATSAPP_SUBMISSION`, `PROCESS_RSS_SUBMISSION`

---

## 8. RSS Ingestion

### Active feeds

| Feed | Source | Trust level | Interval | Filter |
|---|---|---|---|---|
| Transport for Ireland | `data.gov.ie/feed/` | official | 20 min | Keyword |
| The Journal | `thejournal.ie/feed/` | news | 30 min | Keyword |
| Dublin Live | `dublinlive.ie` | news | 30 min | Keyword |
| SDCC | Disabled — SDCC removed RSS | — | — | — |
| Garda Press | Disabled — blocks cloud IPs | — | — | Re-enable on VPS |
| Met Éireann | Disabled — RSS removed | — | — | — |

### Tallaght Geo-Filter
Every RSS item passes a two-pass filter before being queued:

**Pass 1 — Feed-level check**: If the feed is a South Dublin County Council (SDCC) source, it is always relevant — 100% South Dublin scope.

**Pass 2 — Keyword match**: Scans title + content against 40+ keywords including:
- Place names: Tallaght, Jobstown, Belgard, Firhouse, Templeogue, Knocklyon, Rathfarnham, Ballycullen, Clondalkin, Lucan, Rathcoole, Saggart, Newcastle, Brittas
- Infrastructure: Luas Red Line, M50, N81, Belgard Road, Tallaght Hospital, TUD Tallaght, Tallaght Stadium
- Institutions: SDCC, South Dublin County Council, An Garda Síochána South Dublin, ITT Dublin

Items that don't pass the filter are stored in `rss_items` with `isRelevant = false` for analytics but are not processed by the AI.

---

## 9. Object Storage

Images submitted via WhatsApp and images generated by AI are stored in **Replit Object Storage** (backed by Google Cloud Storage).

- **Upload**: `artifacts/api-server/src/lib/objectStorage.ts` and `objectAcl.ts`
- **Serving**: `GET /api/storage/objects/<gcsPath>` — streams directly from GCS with proper content-type headers
- **Image paths**: stored as relative paths in the database (`/api/storage/objects/...`) and resolved to absolute URLs on the frontend when needed (e.g. for OG meta tags in the Vite middleware)
- **ACL**: object access is controlled so only the API server can read/write directly

---

## 10. Public Website

Source: `artifacts/community-website/src/pages/`

### Pages

| Page | Route | Description |
|---|---|---|
| Home | `/` | Hero article, Events This Weekend strip, WhatsApp QR section, Latest Stories feed |
| Category | `/category/:slug` | Filtered article feed for one category |
| Article | `/article/:slug` | Full article with OG meta tags |
| Contributors | `/contributors` | Public list of all consented contributors |
| Advertise | `/advertise` | Static advertise-with-us page |
| About | `/about` | Static about page |
| Terms | `/terms` | Terms of Service (GDPR consent links here) |
| Privacy | `/privacy` | Privacy Policy (GDPR consent links here) |

### Key public website features

**Hero section** — Featured article displayed prominently at the top of the home page. Largest article image, headline, excerpt, contributor credit.

**Category filter bar** — Horizontal scrollable tabs under the nav: All Stories, Business & Local Services, Community & Notices, Events & What's On, News & Issues, Sport.

**Happening This Weekend** — Auto-populated strip showing the 3 most recent articles in the "Events & What's On" category from the past 7 days.

**WhatsApp submission section** — Sits between Events strip and Latest Stories. Shows:
- Scannable QR code (green, WhatsApp branded)
- "Open WhatsApp" button (tap on mobile to start chat directly)
- Phone number displayed for manual dialling
- "Download QR" link — saves as SVG for printing on posters or flyers
- Number auto-converts from local Irish format to international (`wa.me`) format

**OG meta tags (server-side)** — The Vite dev server (and production build) uses a custom middleware plugin that intercepts requests for `/article/:slug`, fetches the article from the API, and injects correct `og:title`, `og:description`, `og:image`, and `og:url` tags into the HTML before it is served. This means WhatsApp, Facebook, and Twitter all show the correct article preview when a link is shared — without any JavaScript.

**Contributor profiles** — Each published article shows the contributor's display name and avatar. The Contributors page lists all consented contributors with their published article count.

**Responsive design** — Full mobile-first responsive layout. The QR section adapts: QR code on left, text + buttons on right at desktop; stacked vertically on mobile.

### Navigation
- Logo → Home
- Home, Contributors, Advertise, About links
- "Send us your story" CTA button in header → scrolls to WhatsApp QR section

---

## 11. Admin Dashboard

Source: `artifacts/admin-dashboard/src/pages/`
URL: `/admin/`
Authentication: password-based (set in Settings, default: `tallaght-admin`)

### Pages

| Page | Purpose |
|---|---|
| Dashboard | Stats overview — submissions today, articles published, pending review, contributor count |
| Review Queue | Articles awaiting human approval — publish, hold, or reject with one click |
| Articles | All articles — filter by status, category, search; edit inline |
| Categories | Manage article categories |
| Contributors | View all contributors, ban/unban, see their submissions |
| RSS Feeds | Add/edit/remove RSS feed sources, toggle active/inactive |
| Golden Examples | Manage few-shot AI examples — the articles that teach the AI the desired writing style |
| AI Usage | Full AI cost breakdown — per submission, per model, per stage; platform-wide totals |
| Settings | All API keys and config values; stored encrypted in the database |
| Login | Password entry page |

### Review Queue
The primary editorial workflow. Every held article appears here with:
- Full article body preview
- Confidence score and source submission
- Original raw WhatsApp message or RSS item
- Category and suggested headline
- **Publish** — makes live immediately, sends WhatsApp notification to contributor
- **Hold** — keeps in queue for later
- **Reject** — removes from queue, logs reason, notifies contributor if WhatsApp submission

### Settings
All sensitive values are stored encrypted in the `settings` table (AES-256-GCM via the encryption module). The Settings page shows masked values and lets the admin update them. Key settings:
- OpenAI API key
- WhatsApp access token (the most common source of `#131005` errors — must be a permanent System User token, not a temporary developer token that expires every 24 hours)
- WhatsApp phone number ID
- Webhook verify token + app secret
- Platform WhatsApp display number (drives the QR code on the public website)
- Auto-publish confidence threshold (default 0.75)
- Admin password

---

## 12. Infrastructure Notes

### WhatsApp token management
**Critical ongoing issue**: Temporary developer tokens expire every 24 hours, causing all outbound WhatsApp messages to fail with error `#131005`.

**Permanent fix** (not yet done):
1. Go to business.facebook.com → System Users
2. Create a System User with the `whatsapp_business_messaging` permission
3. Generate a token with no expiry
4. Update the `whatsapp_access_token` in admin Settings

### Production environment
- VPS: 185.43.233.219, API on port 8080
- Do **not** run `docker compose up -d` without specifying a service name on the VPS
- Production migrations run automatically via Replit on publish

### Phone number handling
Raw phone numbers are **never stored in plaintext** in the database. They are SHA-256 hashed with a Tallaght-specific salt (`tallaght:{phone}`) before storage. The hash is irreversible. The only exception is `phoneNumber` on the contributors table, which is stored in plaintext **only after a contributor has given GDPR consent** and is used solely for outbound publish notifications.

### Image URL resolution
Images are stored with relative paths (`/api/storage/objects/...`) in the database. The Vite middleware resolves these to absolute URLs when building OG meta tags, prepending the request origin.

---

## 13. Planned Features

---

### 13.1 AI-Generated Header Images (DALL·E 3)

**What**: When an article has no header image (most WhatsApp text submissions, all RSS articles), the AI generates a contextually appropriate image using DALL·E 3.

**How it works**:
- Triggers after Stage 6 (article writing) when no image was submitted
- Uses the extracted headline + key facts to build a DALL·E 3 prompt
- Prompt style: `"photorealistic community news photography, no text, no watermarks, vibrant but factual"`
- Special cases: sports → symbolic imagery using kit colours; events → crowd/venue scenes; infrastructure → roads, Luas, buses
- Generated image URL (expires in ~1hr) downloaded immediately and uploaded to Object Storage
- Stored as `posts.header_image_url` exactly like a submitted image

**Cost**: ~$0.04 per image (DALL·E 3 standard 1024×1024). Only triggers when no image exists.

**Admin controls**:
- "Auto-generate images" toggle in Settings
- "Regenerate image" button per article in admin
- Shows the DALL·E prompt used for transparency

**Database addition**: `imagePrompt` column (text, nullable) on `posts` table

**Logo compositing extension**: An optional second step after DALL·E generation — for RSS feeds from clubs or organisations, composite their logo onto the generated background image using `sharp` (Node.js). Logo URL stored on `rss_feeds` table. Positioned bottom-corner with a subtle badge background.

---

### 13.2 Community Reaction Pieces (WhatsApp Hashtag System)

**What**: Published articles can be assigned a short hashtag (e.g. `#riot`, `#busroute`). Social posts and the article footer invite readers to WhatsApp their opinion with that tag. Responses are collected and synthesised by AI into a "Community Reacts" companion article.

**How it works**:
1. Admin assigns a reaction hashtag to a published article
2. Social post / article footer: *"Have your say — WhatsApp us with #riot + your view"*
3. Any incoming WhatsApp message starting with `#` is intercepted before the AI pipeline
4. Tag is looked up against `posts.reactionHashtag` — if found, stored as a reaction record, not an article submission
5. After a set window (e.g. 48 hours), admin triggers AI synthesis
6. AI receives the original article + all approved reactions → writes companion piece
7. Companion piece goes to Review Queue

**New table**: `article_reactions` — `articleId`, `contributorId`, `rawText`, `sentiment`, `safetyPassed`, `includedInPiece`

**Database addition**: `reactionHashtag` (varchar, unique), `reactionWindowClosesAt` (timestamp), `reactionPieceId` (FK → posts) on `posts` table

---

### 13.3 AI Clarification Loop

**What**: When a submission is incomplete or ambiguous, the AI asks the contributor a clarifying question via WhatsApp before writing the article.

**When triggered**:
- `completenessScore < 0.5` from Stage 5
- Missing location, date, or key facts for event-type submissions

**The flow**:
1. AI writes a targeted clarification question (1 question only — not a list)
2. Sent via WhatsApp: *"Thanks for your message! To write the best article, could you tell us: where exactly did this happen?"*
3. Contributor replies → merged with original submission → full pipeline resumes
4. If no reply within 24 hours (WhatsApp window closes) → article written with available information, routed to Review Queue with note "contributor did not respond to clarification"

**Constraint**: Must be sent within 24 hours of the original message (WhatsApp Customer Service Window)

**Database addition**: `clarificationPending` boolean, `clarificationQuestion` text, `clarificationSentAt` timestamp on `submissions` table

---

### 13.4 Newsletter System (WhatsApp + Email)

**What**: A monthly newsletter compiled from the best articles of that month, delivered via WhatsApp and/or email. Subscribers manage their own preference.

**Subscriber sign-up**:
- Website form: email (required) + optional WhatsApp number
- Via WhatsApp: keyword `NEWSLETTER` → prompted for email

**WhatsApp delivery (free)**:
- When someone messages the WhatsApp number, the webhook checks if there is a published newsletter for this month that they haven't received yet
- If yes → newsletter link + preference prompt appended to their acknowledgment reply (within 24-hour window — free)
- Tracked in `newsletter_wa_sends` to avoid duplicate sends

**Email delivery**: Via Resend (3,000 emails/month free tier). HTML email with top stories, images, CTAs.

**Admin generation**:
- "Generate [Month] Newsletter" button → AI selects top articles (best by category, diverse topics)
- Admin previews, can add/remove articles, edit intro paragraph
- Publish → creates public newsletter page + queues delivery

**New tables**: `newsletter_subscribers`, `newsletters`, `newsletter_wa_sends`

---

### 13.5 Social Media Comments → AI Opinion Pieces

**What**: After an article is shared to Facebook/Instagram, public comments on that post are fetched via Graph API, moderated, and synthesised into a "Community Reacts" companion article.

**How it works**:
- When an article is posted to social media, the returned platform post ID is saved on the article
- Comment polling at: 2 hours, 6 hours, and 24 hours after posting
- Comments fetched via Facebook/Instagram Graph API
- Each comment passes moderation + sentiment analysis
- Admin triggers AI synthesis when enough approved comments exist (or auto-trigger at 10+)
- Generated piece never names individual commenters: *"One local resident commented…"*

**New table**: `social_comments` — `articleId`, `platform`, `platformCommentId`, `rawText`, `safetyPassed`, `sentiment`, `likesCount`, `includedInPiece`

**Database addition**: `facebookPostId`, `instagramMediaId` on `posts` table

---

### 13.6 Per-Article AI Cost Display

**What**: Individual articles in the admin show exactly how much they cost to generate.

**What exists**: `ai_usage_log` already records every OpenAI call with costs, linked to `submission_id`.

**What's needed**:
- `GET /api/admin/posts/:id/cost` endpoint — sums all usage log entries for the article's source submission
- Cost badge on article cards in the Articles page (e.g. `$0.009`)
- Full cost breakdown in article detail view — per stage, per model, total spend
- Articles processed before usage tracking was added show a "legacy — no cost data" label rather than $0.00

---

### 13.7 Contributor Reputation Tiers

**What**: Trusted contributors get faster publication and higher trust weighting.

| Tier | Name | Criteria | Benefit |
|---|---|---|---|
| 0 | New | First submission | Full pipeline, standard thresholds |
| 1 | Regular | 3+ published, no violations | Confidence threshold −0.05 |
| 2 | Trusted | 10+ published, no violations in 90 days | Threshold −0.10, skips Stage 1 moderation |
| 3 | Verified | Admin-manually assigned | Auto-publish regardless of confidence |

- Tiers 0–2 recalculated automatically on each submission
- Tier 3 admin-only (for councillors, known community figures, local organisations)
- Admin can promote or demote any contributor

**Database additions**: `reputationTier` (0–3), `violationCount`, `lastViolationAt` on `contributors` table

---

### 13.8 Duplicate Detection (Multi-Contributor Articles)

**What**: If two people WhatsApp about the same real-world event, their submissions are merged into one richer article instead of creating duplicates.

**How it works**:
- After Stage 5 (info extraction), compare against articles published in the last 6 hours
- Matching is semantic (GPT judges similarity), not keyword — threshold 0.8 (conservative)
- On match: new facts merged into existing article → AI rewrites with combined information → article gets "Updated [time]" timestamp and "Multiple contributors" badge
- New contributor gets a different acknowledgment: *"Thanks — your update has been added to our existing story."*
- If core facts change significantly → re-routes to Review Queue

**New table**: `article_contributors` — `articleId`, `contributorId`, `submissionId`, `role` (`original` / `update`)

**Database additions**: `lastUpdatedAt`, `isMultiContributor`, `updateCount` on `posts` table

---

### 13.9 Events Calendar & Directory

**What**: Event-type submissions generate both an article AND a structured event record. A dedicated `/events` page shows upcoming events in calendar/list view.

**How the AI detects events** (Stage 4 gains a new type: `event`):
- Explicit future date/day ("this Saturday", "April 12th")
- Location + time pattern ("at the library at 2pm")
- Invitation language ("everyone welcome", "free entry", "all ages")
- Event vocabulary: workshop, clean-up, fundraiser, match, ceremony, opening

**Two outputs from one submission**:
1. Full article under Events & What's On category
2. Event record in `events` table with structured fields

**New table**: `events` — `id`, `articleId` (FK, nullable), `title`, `eventDate`, `eventTime`, `location`, `description`, `status` (`upcoming` / `past` / `cancelled`)

**Public website addition**: `/events` page — upcoming events sorted by date, past events auto-archived, each links to its article

---

### 13.10 Contributor Pre-Publish Review (WhatsApp Approval Loop)

**What**: Before certain articles are published, the contributor receives a summary via WhatsApp and is asked to approve it. This catches factual errors before they go live.

**When triggered** (not every article — adds delay and cost):
- Confidence score between 0.50–0.74
- Submission contains a personal name (higher stakes)
- Contributor's first or second article (build trust early)
- Admin has enabled "always review" for a specific contributor

**The flow**:
1. AI writes article (Stage 6 complete)
2. Summary sent to contributor via WhatsApp with YES/NO prompt
3. YES → moves to Review Queue (or auto-publishes if confidence high enough)
4. NO + reason → AI revises (max 2 rounds) → sends updated version back
5. No reply within 24 hours → article moves to Review Queue with note "contributor did not review"

**Constraint**: Must be sent within the 24-hour WhatsApp Customer Service Window

---

### 13.11 Analytics Integrations (Google + Meta)

**What**: Key metrics from Google Analytics, Search Console, and Meta Business Suite surfaced directly in the admin dashboard.

**Google Analytics**: Weekly unique visitors, page views, top articles by traffic, traffic sources.

**Google Search Console**: Top search queries, click-through rates, position for local terms ("Tallaght news", "what's on in Tallaght").

**Meta Business Suite**: Facebook page reach, post engagement per post, follower growth, best-performing posts — matched back to the articles they came from.

**Admin Analytics page** shows all three sources unified in one view plus internal content stats (submissions/week, published count, auto-published vs held vs rejected, new contributors/week, consent rate).

**Privacy note**: GA4 uses cookies — Privacy Policy will need updating and a cookie consent banner added (GDPR requirement) before GA4 is enabled.

---

### 13.12 Full-Text Search

**What**: A search bar on the public website letting residents search all published articles (e.g. "Tallaght fire", "Jobstown flooding", "Old Bawn road").

**Implementation**:
- PostgreSQL native full-text search (`tsvector` / `tsquery`) — no external search service needed
- `searchVector` computed column on `posts` table, updated on publish/edit
- Search bar in the public website header
- `/search?q=...` route
- Ranked by relevance (PostgreSQL handles natively)
- Zero results → *"No articles found for 'query'. Got a story about this? WhatsApp us."* — turns a dead end into a submission

**What gets indexed**: Headline (highest weight), body text, category, location, tags

**Admin search**: Searches across submissions, contributors, and the Review Queue

---

### 13.13 WhatsApp Message Templates (Outbound beyond 24-Hour Window)

**What**: Meta only allows free-form WhatsApp messages within 24 hours of the user's last message. For delayed notifications (e.g. article published 3 days after submission), pre-approved Message Templates are required.

**Which notifications may need templates**:
- "Your article is live" — if processing took >24 hours
- Monthly newsletter link — for pre-existing subscribers who haven't messaged recently
- Reputation tier upgrade notification

**Required action**: Design and submit templates to Meta for approval via the Meta Business Manager. Templates must be fixed-format (variable slots allowed, but structure is pre-approved).

---

## 14. Security

| Concern | Implementation |
|---|---|
| Phone number privacy | SHA-256 hashed with Tallaght-specific salt — irreversible |
| Admin authentication | Password stored as bcrypt hash in encrypted settings table |
| Settings encryption | AES-256-GCM, key derived from environment secret |
| Webhook validation | HMAC-SHA256 signature checked against `whatsapp_app_secret` |
| AI content safety | OpenAI Moderation API as Stage 1 gate — all content screened before processing |
| Contributor banning | Banned contributors' messages silently discarded — no processing cost |
| Object storage ACL | Images not publicly addressable — served only through authenticated API route |

---

## 15. Cost Model

| Component | Estimated cost |
|---|---|
| GPT-4o article writing (per article) | ~$0.005–$0.015 |
| GPT-4o-mini classification + extraction | ~$0.0005 per submission |
| Whisper transcription (voice notes) | ~$0.006 per minute of audio |
| GPT-4o Vision (images) | ~$0.003–$0.005 per image |
| OpenAI Moderation | Free |
| DALL·E 3 header images (planned) | ~$0.04 per image |
| WhatsApp outbound messages | Free within 24-hour Customer Service Window; ~$0.005–$0.08 per template message (varies by country) |
| Resend email (planned newsletter) | Free up to 3,000/month |

All AI costs are tracked per article in the `ai_usage_log` table and visible in the admin AI Usage page.

---

*This document is generated from the live codebase. To update it, re-read the source files in `artifacts/`, `lib/db/src/schema/`, and `replit.md`.*
