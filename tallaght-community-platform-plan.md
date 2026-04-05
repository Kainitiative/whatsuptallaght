# Tallaght Community Platform — Full Project Plan

  > **Working title:** Tallaght Community (brand name TBD)
  > **Last updated:** March 2026
  > **Status:** Planning complete — ready for phased build

  ---

  ## Table of Contents

  1. [Concept](#concept)
  2. [How It Works — Overview](#how-it-works)
  3. [Content Sources](#content-sources)
  4. [The Full Processing Pipeline](#the-full-processing-pipeline)
  5. [The AI Stack](#the-ai-stack)
  6. [Header Image Strategy](#header-image-strategy)
  7. [Hallucination Control & Quality Improvement](#hallucination-control--quality-improvement)
  8. [Content & Categories](#content--categories)
  9. [Contributor System](#contributor-system)
  10. [WhatsApp Commands](#whatsapp-commands)
  11. [Spam & Abuse Handling](#spam--abuse-handling)
  12. [Admin Dashboard](#admin-dashboard)
  13. [The Public Website](#the-public-website)
      - [Visual Design Direction](#visual-design-direction)
  14. [Social Distribution](#social-distribution)
  15. [Processing Queue & Scalability](#processing-queue--scalability)
  16. [Revenue Model](#revenue-model)
  17. [Third-Party Services](#third-party-services)
  18. [Cost Estimates](#cost-estimates)
  19. [Future Features Roadmap](#future-features-roadmap)
  20. [Deployment Infrastructure](#deployment-infrastructure)
  21. [Build Phases](#build-phases)

  ---

  ## Concept

  A real-time, AI-powered local information hub for Tallaght, Dublin. Content arrives from two sources — WhatsApp messages from community members, and RSS feeds from official organisations. AI processes both into professionally written, categorised, and visually produced articles that appear on a public website and are automatically distributed to Facebook and Instagram.

  **No accounts. No forms. No apps. Just send a WhatsApp message.**

  The platform acts as a live digital noticeboard, news feed, and community hub for Tallaght. The goal is low-friction input and high-quality output — anyone can contribute in seconds, while the public-facing site remains clean, organised, and useful.

  ---

  ## How It Works

  ### The Growth Loop

  ```
  People see the platform online
      ↓
  They see the WhatsApp number
      ↓
  They send content
      ↓
  AI publishes it within minutes
      ↓
  More people see it
      ↓
  Loop repeats and grows
  ```

  ### The Value Proposition

  | For contributors | For readers |
  |---|---|
  | No sign-up required | One place for everything local |
  | Send text, images, or voice notes | Professionally written articles |
  | Published within minutes | Organised, searchable, categorised |
  | WhatsApp confirmation when live | Real community voices |
  | Credit and recognition over time | Trusted official sources included |

  ---

  ## Content Sources

  ### Source 1 — WhatsApp Submissions

  Anyone in the community sends a message to a dedicated WhatsApp Business number. Supported message types:
  - Plain text
  - Images (photos, posters, screenshots)
  - Voice notes
  - Any combination of the above

  ### Source 2 — RSS Feeds

  The system polls a configurable list of official feeds on a scheduled basis (every 30–60 minutes). Content is filtered geographically before any AI processing begins.

  **Initial RSS sources:**
  - South Dublin County Council
  - Transport for Ireland (Luas Red Line, Dublin Bus)
  - Irish Water (outages, maintenance notices)
  - HSE (local health service updates)
  - An Garda Síochána (Tallaght District notices)

  Additional feeds can be added by the admin at any time.

  ---

  ## The Full Processing Pipeline

  ### WhatsApp Route

  ```
  Message arrives via WhatsApp
      ↓
  Is sender banned?
      → Yes → Reply "suspended until [date]", log attempt, stop
      ↓ No
  Is it a command? (HELP / MY POSTS / STATUS / DELETE / STOP)
      → Yes → Handle from database, send reply, stop — zero AI cost
      ↓ Not a command
  Safety check (OpenAI Moderation API — free)
      → Harmful content detected → Delete, ban sender, send notice, log
      ↓ Safe
  Store raw submission + upsert contributor profile (by phone number)
      ↓
  Voice note included? → Whisper transcription
  Image(s) included? → Download to object storage + GPT-4o Vision reads and extracts details
      ↓
  Add to processing queue
      ↓
  Worker processes job:
    1. Tone classification (GPT-4o-mini) — news / event / sports / memorial etc.
    2. Data extraction (GPT-4o-mini) — title, date, time, location, contributor name, categories, confidence score
    3. Editorial writing (GPT-4o) — article written to the natural length of the submission, maximum 500 words, using platform voice, tone register, and golden examples. A simple event notice may be 80 words; a community story may be 400. The AI writes what the content warrants, not a fixed target.
    4. Header assignment — template by category (Phase 1) or DALL-E generated (Phase 2)
      ↓
  Confidence routing:
    > 0.8 → Auto-publish + WhatsApp confirmation sent to submitter
    0.5–0.8 → Hold for admin review + WhatsApp acknowledgement sent
    < 0.5 → Ask follow-up question or reject + WhatsApp reply explaining outcome
      ↓
  On publish → Social distribution job added to queue
  ```

  ### RSS Route

  ```
  Scheduled check every 30–60 minutes
      ↓
  New items found in feed?
      ↓ Yes
  Layer 1 — Keyword filter: does item mention Tallaght-area place names?
      → No → Skip, log as outside area, done — zero cost
      → Yes → Continue
      ↓
  Layer 2 — Ambiguous? Quick AI relevance check (GPT-4o-mini)
      → Not relevant → Skip
      → Relevant → Continue
      ↓
  Duplicate check — has this item URL already been processed?
      → Yes → Skip
      ↓
  Add to processing queue (same queue as WhatsApp submissions)
      ↓
  Worker processes job:
    1. Tone classification
    2. Data extraction
    3. AI writes summary article to natural length, maximum 300 words, with attribution + link to original source
    4. Template header assigned by category — RSS posts never use DALL-E generation
      ↓
  Auto-publish (official verified source = high trust, no review needed)
      ↓
  Social distribution job added to queue
  ```

  ---

  ## The AI Stack

  Seven distinct AI roles, each using the right model for the job. No single model handles everything.

  | # | Stage | Model | Purpose | Cost per call |
  |---|---|---|---|---|
  | 1 | Safety check | OpenAI Moderation API | Detect harmful content before any processing | Free |
  | 2 | Geographic relevance | GPT-4o-mini | Is this RSS item relevant to Tallaght? | ~€0.001 |
  | 3 | Voice transcription | OpenAI Whisper | Audio → text transcript | ~€0.003/min |
  | 4 | Image reading | GPT-4o Vision | Extract text/details from submitted images | ~€0.005/image |
  | 5 | Tone classification | GPT-4o-mini | Assign emotional register to submission | ~€0.0001 |
  | 6 | Data extraction | GPT-4o-mini | Extract title, date, location, categories, name, confidence | ~€0.0002 |
  | 7 | Editorial writing | GPT-4o | Write the full article using platform voice + golden examples | ~€0.014 |
  | 8 | Header generation | DALL-E 3 HD | Generate branded header image (Phase 2 only) | ~€0.074 |

  ### Tone Registers

  The AI classifies every submission into one of these registers before writing:

  | Register | Examples | Writing style |
  |---|---|---|
  | Breaking / Serious | Fire, accident, crime, missing person | Formal, factual, news wire style |
  | Community Alert | Road closure, water outage, safety notice | Clear, direct, urgent but calm |
  | Event / Celebratory | Festival, concert, fundraiser, open day | Warm, inviting, upbeat |
  | Sports | Match result, fixture, club news | Energetic, punchy, stats-forward |
  | Business | New opening, closure, offer | Professional but accessible |
  | Lifestyle | Food, culture, hobby, personal story | Conversational, engaging |
  | Memorial | Death notice, anniversary, tribute | Respectful, gentle, measured |

  ### The Writing Prompt Structure

  Every article is written with four layers of context injected in order:

  1. **System prompt** — permanent, defines the platform's editorial voice and rules
  2. **Tone register** — set per submission based on classification
  3. **Golden examples** — top 3–5 most relevant past highly-rated posts (by category and tone)
  4. **Submission content** — the actual message, extracted facts, and any image descriptions

  ---

  ## Header Image Strategy

  ### Phase 1 — Launch (Template Headers)

  A library of pre-designed category header images. The AI selects the correct one based on the post's category. Zero image generation cost. Site looks visually consistent from day one.

  | Category | Template header |
  |---|---|
  | Events | Crowd/festival atmosphere |
  | Sports | Action/stadium imagery |
  | Business | Local streetscape/shopfront |
  | Community | Neighbourhood/people imagery |
  | Breaking News | Bold, graphic, urgent |
  | Memorial | Respectful, understated |
  | Alerts | Clear, attention-grabbing graphic |

  ### Phase 2 — When Branding Is Established (Generated Headers)

  DALL-E 3 HD generates a unique, bespoke header for each post in the platform's defined visual style. Switched on per category — high-value content types first.

  ### Hybrid Rule

  If a user submitted a relevant image with their post:
  - Their image is stored and displayed in the post body/gallery
  - A branded overlay/watermark is applied for visual consistency
  - The category template or generated header still appears at the top of the post

  ---

  ## Hallucination Control & Quality Improvement

  ### Preventing Hallucinations

  Seven guardrails ensure the AI only publishes accurate information:

  1. **Strict sourcing rules** — AI is instructed to use only facts present in the original submission. Never invent, infer, or fill gaps.
  2. **Extract before write** — Facts are extracted as a verified structured list before the writing stage begins. The writer works from the list, not the raw message.
  3. **Confidence scoring** — Incomplete submissions score low. Low score = ask the contributor for missing details before writing, not guess.
  4. **Contributor preview** — For medium-confidence posts, the contributor can be sent a draft for confirmation before submission to the review queue.
  5. **Admin side-by-side view** — Admin sees the original WhatsApp message alongside the AI draft. Any invented detail is immediately obvious.
  6. **Temperature control** — Low temperature settings for factual extraction (conservative, precise). Slightly higher for writing (expressive but grounded in verified facts only).
  7. **No general knowledge for facts** — AI cannot use what it knows about Tallaght to fill in gaps. If the submitter didn't say the location, it doesn't go in.

  ### Quality Improvement — The Golden Examples Loop

  1. Admin reviews held posts and assigns a star rating (1–5)
  2. Posts rated 4–5 stars are stored as golden examples, tagged by category and tone register
  3. Golden examples are injected into the writing prompt for all future posts in the same category/tone
  4. Output quality improves continuously as the library grows
  5. Long-term: enough examples to fine-tune a dedicated smaller model at lower cost

  ---

  ## Content & Categories

  ### Post Types

  The data model supports multiple post types, each with type-specific fields:

  | Post type | Extra fields |
  |---|---|
  | Article (default) | Standard title, body, images, categories |
  | Event | Date, time, venue, ticket price, organiser |
  | Review | Business name, star rating, category |
  | Classified / Listing | Price, condition, contact method, expiry date |
  | Lost & Found | Item description, last seen location, contact, expiry |
  | Job Listing | Role, employer, salary range, application method, closing date |

  ### Categories

  - **Multi-category:** Each post can belong to more than one category
  - **Admin-managed:** Admin creates, merges, and reorganises categories at any time
  - **AI suggests, human confirms:** AI assigns categories; admin can override or add at any point
  - **Posts never expire:** All published content stays live indefinitely for SEO value
  - **Archiving:** Old event posts can be auto-archived after their date passes (configurable). Archived posts remain at their URL and are still indexed by Google, but are removed from the main feed.

  **Starting categories:**
  Events, Sports, Business, Community Notices, Local News, Alerts, Memorial Notices, Lifestyle, Food & Drink, Education, Health & Wellbeing, Transport

  ---

  ## Contributor System

  ### Identity Progression

  | Phase | What contributors get |
  |---|---|
  | Phase 1 | Fully anonymous. Credited as "WhatsApp Submission" |
  | Phase 2 | Name included in message. AI extracts it. Credited as "Submitted by [Name]" |
  | Phase 3 | Repeat contributors (5+ published posts) receive automated WhatsApp invite to create a profile |
  | Phase 4 | Featured on "Meet Our Contributors" page with photo, bio, post count, and link to all their articles |

  ### Contributor Profile (Phase 3+)

  When invited, contributor replies with:
  - **Name** — extracted from message
  - **Short bio** — processed by AI to clean up language
  - **Selfie** — stored as profile photo

  ### Contributor Tracking

  Each contributor is tracked by phone number (not personal identity). The system stores:
  - First seen date
  - Total submissions
  - Total published posts
  - Last active date
  - Submission history
  - Ban status and history
  - Display name (if provided)

  ---

  ## WhatsApp Commands

  All commands are handled directly from the database. Zero AI cost.

  | Command | Response |
  |---|---|
  | `HELP` | Lists all available commands |
  | `MY POSTS` | Numbered list of their published articles with titles and dates |
  | `STATUS` | Status of their most recent submission (held / published / rejected) |
  | `DELETE [number]` | Flags post for admin review and removal (published posts go to admin queue, not auto-deleted) |
  | `STOP` | Unsubscribes from all system replies (GDPR compliance) |

  ---

  ## Spam & Abuse Handling

  ### Detection

  Every submission passes through the OpenAI Moderation API (free) before any processing begins. Checks for: violence, explicit content, hate speech, harassment.

  ### Response on Detection

  1. Content deleted immediately (never processed or stored in readable form)
  2. Phone number banned with escalating duration:
     - First offence → 24 hours
     - Second offence → 7 days
     - Third offence → Permanent (manual unban by admin only)
  3. Generic suspension notice sent via WhatsApp (no details that help circumvent detection)
  4. All incidents logged for admin review

  ### On Attempt from Banned Number

  Message intercepted before queue. Suspension notice sent. Attempt logged.

  ### Admin Controls

  - View and manage bans
  - Manually unban contributors
  - Adjust ban thresholds
  - View incident log

  ---

  ## Admin Dashboard

  ### Access

  - Login with username and password
  - Additional admins invited by email only — secure invite link, set own password on registration
  - Invites expire if unused

  ### Roles

  | Role | Access |
  |---|---|
  | Super Admin | Full access: categories, settings, RSS feeds, admin invites, all post management |
  | Moderator | Review queue only |

  ### Features

  - **Moderation queue** — original message + AI draft + confidence score + contributor info (masked phone)
  - **Post actions** — approve (publish), reject, edit-then-approve
  - **Star rating** — rate each reviewed post to feed the golden examples library
  - **Contributor management** — submission history, ban status, manual ban/unban
  - **RSS feed management** — add/remove feeds, set per-feed geographic scope, set daily post limits, enable/disable
  - **Processing queue status** — pending / processing / done / failed jobs, with retry controls
  - **Social distribution status** — per-post distribution status (shared / failed / pending)
  - **Category management** — create, merge, reassign, reorder
  - **Geographic coverage settings** — editable list of Tallaght-area place names used for RSS filtering
  - **Header template library** — upload and manage Phase 1 template headers per category
  - **Advertise With Us** — contact and media kit management

  ---

  ## The Public Website

  ### Design Principles

  - Read-only for visitors — no comments, no registration, no accounts required
  - Article-based output only
  - SEO-first — clean URLs, permanent content, fast loading
  - Every post is a permanent indexed URL

  ---

  ### Visual Design Direction

  #### Reference Sites (Mood Board)

  The design direction was established from four reference sites chosen by the owner:

  | Site | What It Contributes |
  |---|---|
  | **Yelp** (yelp.ie) | Primary layout model — card-based discovery, category filter bars, strong local identity, functional and community-driven |
  | **Euronews** (euronews.com) | Category-led navigation, breaking/featured story treatment, card grid hierarchy |
  | **The New Humanitarian** | Editorial authority, strong photo treatment, confident typography, content-first |
  | **The Design Japan** | Restraint and whitespace — things breathe, quality over quantity, nothing crammed |

  **Overall feel:** A Yelp-style community discovery platform — warm, functional, and unmistakably local. Yelp is the strongest influence: functional discovery, card-based layout, category filters, and community contributor identity on display.

  ---

  #### Colour Palette

  Colours are drawn directly from the **Tallaght Unity Flag** (An Bratach Aontacht Thamlachta, 2017), which was created through community surveys — the people of Tallaght chose red, green, white, and blue to represent themselves. This gives the platform a genuine, rooted identity rather than invented brand colours.

  | Role | Colour | Source | Usage |
  |---|---|---|---|
  | **Primary** | Deep community red | Flag — the field | Header, logo, primary CTAs, featured labels |
  | **Secondary** | Rich forest green | Flag — second field colour | Community CTAs, WhatsApp button, hover states |
  | **Accent** | Flag blue | Flag — Battle of Tallaght stars (1867) | Links, interactive elements, map elements |
  | **Base** | Clean white | Flag — the bend | Page backgrounds, article reading surface |
  | **Surface** | Light warm grey | — | Card backgrounds, section dividers |
  | **Text** | Near-black charcoal | — | All body text and headlines |

  This palette aligns naturally with Yelp's design language — Yelp also uses red as its primary brand colour.

  #### Category Colour Coding

  Each content category is assigned a colour from the flag palette so users can identify content type at a glance on cards and tags:

  | Category | Colour | Feeling |
  |---|---|---|
  | Events & What's On | Red | Energetic, urgent |
  | Community & Notices | Green | Local, warm, civic |
  | Sport | Blue | Active, trustworthy |
  | Business & Local Services | Warm amber | Neutral, commercial |
  | News & Issues | Charcoal | Serious, informational |

  ---

  #### Typography

  - **Headlines:** A warm, characterful sans-serif — readable and confident, not corporate or decorative. Strong weight for scannability.
  - **Body text:** Clean, high-readability sans-serif optimised for comfortable reading across all ages and screen sizes
  - **Sizing:** Errs larger than typical — the audience spans all demographics in Tallaght
  - **Line spacing:** Generous throughout — influenced by Design Japan's restraint

  ---

  #### Homepage Layout

  Yelp-inspired structure from top to bottom:

  1. **Header bar** — site name/logo (red), search field, WhatsApp CTA button (green), category navigation
  2. **Category icon row** — horizontal strip: Events · Sport · Business · Community · News · What's On (each with a small icon and colour tag)
  3. **Hero/featured article** — full-width card, large image, bold headline, category tag
  4. **"Happening This Weekend"** — a curated horizontal strip of upcoming events
  5. **Main card grid** — three columns desktop / one column mobile; each card has: dominant image, colour-coded category tag, bold headline, time posted, contributor first name
  6. **Load more / pagination** at the bottom

  #### Article Page Layout

  - Full-width header image at the top
  - Clean single reading column — no sidebar, no distractions
  - Category tag + date + contributor credit below the headline
  - Generous line length and spacing for comfortable reading
  - Related articles strip at the bottom

  #### Card Design

  Each article card contains:
  - Dominant image (cropped to a consistent aspect ratio)
  - Colour-coded category tag in the top corner
  - Bold headline (2–3 lines max)
  - Time posted ("2 hours ago", "Yesterday")
  - Contributor first name and area ("Submitted by Maria, Jobstown") — shown once contributor identity is established

  #### WhatsApp Submission CTA

  - Present on every page — pinned in the header alongside the logo
  - Green button using WhatsApp's own colour (reinforces instant recognition)
  - Warm, community-friendly copy: **"Send us your story"**
  - Never intrusive — functional, not a popup or overlay

  ---

  #### Flag Usage Note

  The platform draws colour inspiration from the Tallaght Unity Flag — it does not reproduce the flag graphic itself. If the brand identity ever incorporates the actual flag design, the Tallaght Historical Society should be contacted (they actively encourage community use and have a simple email protocol).

  ---

  ### Pages

  | Page | Purpose |
  |---|---|
  | Home | Live feed of published posts, filterable by category, searchable |
  | Post Detail | Full article, submitted images, category tags, contributor credit, source attribution for RSS, link to original for RSS-sourced content |
  | Category Pages | All posts in a given category |
  | Contributors | Featured contributors with photo, bio, post count, link to their articles |
  | About / Submit | Explains the platform, how to submit via WhatsApp, the WhatsApp number, call-to-action |
  | Advertise With Us | Media kit, contact form for advertising enquiries |

  ---

  ## Social Distribution

  On every publish (auto or manual):

  1. Post to Facebook Page — title, short excerpt, link back to article
  2. Post to Instagram — via Instagram Graph API connected to the same Facebook App
  3. Distribution status stored on the post record (shared / failed / pending)
  4. Failed distributions retried once automatically; persistent failures logged for admin
  5. Admin dashboard shows distribution status per post

  Both WhatsApp and Facebook/Instagram distribution operate through Meta's platform — a single Meta Developer App handles all three.

  ---

  ## Processing Queue & Scalability

  ### Why a Queue

  Instead of processing submissions immediately, every job enters a queue. A background worker picks up jobs at a controlled rate. This means:

  - Webhook responds instantly (Meta requires fast acknowledgement)
  - Processing happens steadily in the background regardless of submission spikes
  - Failures are retried automatically without losing jobs
  - The system never gets overwhelmed by burst activity

  ### Job States

  | State | Meaning |
  |---|---|
  | Pending | Waiting to be picked up |
  | Processing | Currently being worked on |
  | Done | Completed successfully |
  | Failed | Failed after 3 attempts — admin notified |

  ### Retry Policy

  - Failure 1 → retry after 60 seconds
  - Failure 2 → retry after 5 minutes
  - Failure 3 → move to failed queue, alert admin

  ### Capacity at 100 Posts/Day

  | Metric | Value |
  |---|---|
  | Average posts per hour | ~4–5 |
  | Processing time per post | ~15–25 seconds |
  | Concurrent workers | 3–5 |
  | Time to clear 20-post burst | ~2 minutes |
  | OpenAI rate limit headroom | Very comfortable — limit concerns begin at 500+ posts/hour |

  ---

  ## Revenue Model

  ### Phase 1 — Early Stage (Launch to ~12 months)

  | Stream | Description | Potential |
  |---|---|---|
  | Sponsored articles | Local businesses pay to have an article written and published about them | €100–500 per article |
  | Featured event listings | Event organisers pay for prominent placement in the Events section | €20–100 per week |
  | Community / government grants | South Dublin County Council, Pobal, and similar schemes fund local media initiatives | Variable |

  ### Phase 2 — Growing Audience (12–24 months)

  | Stream | Description | Potential |
  |---|---|---|
  | Featured business listings | Verified/featured status in the business directory | €20–50/month per business |
  | Weekly newsletter sponsorship | One local business sponsors the "What's On This Week" email digest | €50–200 per issue |
  | Direct display advertising | Local businesses buy banner/sidebar ad placements directly | €200–2,000/month |

  ### Phase 3 — Scale (24+ months)

  | Stream | Description | Potential |
  |---|---|---|
  | Programmatic advertising | Google AdSense and similar at significant traffic volumes | €500–2,500+/month |
  | Premium direct advertising | Established relationships with local solicitors, car dealers, pharmacies etc. | €1,000–5,000+/month |
  | Network expansion | Replicate the platform in Clondalkin, Lucan, Ballymun etc. | Significant multiplier |

  ### Advertising Revenue at Scale (Estimated)

  | Monthly visitors | Display ads | Direct local ads | Combined |
  |---|---|---|---|
  | 50,000 | €50–150 | €200–500 | €250–650/month |
  | 200,000 | €200–600 | €800–2,000 | €1,000–2,600/month |
  | 500,000 | €500–1,500 | €2,000–5,000 | €2,500–6,500/month |

  ---

  ## Third-Party Services

  | Service | Purpose | Cost |
  |---|---|---|
  | Meta WhatsApp Cloud API | Receiving and sending WhatsApp messages | Free (user-initiated conversations) |
  | OpenAI — Whisper | Voice transcription | ~€0.006/minute |
  | OpenAI — GPT-4o | Editorial writing + image reading | ~€0.014 per article |
  | OpenAI — GPT-4o-mini | Classification, extraction, relevance checks | ~€0.001 per article total |
  | OpenAI — DALL-E 3 HD | Generated header images (Phase 2) | ~€0.074 per image |
  | OpenAI — Moderation API | Safety screening | Free |
  | Meta Graph API | Facebook Page + Instagram distribution | Free |
  | Email service (Resend) | Admin invitation emails | Free tier sufficient |
  | Object storage | Submitted and generated images | ~€0.001 per post |

  ---

  ## Cost Estimates

  ### Per Post — WhatsApp Submission (Phase 1 Template Headers)

  | Stage | Cost |
  |---|---|
  | Safety check | €0.000 |
  | Image reading (2 images) | €0.010 |
  | Tone + extraction | €0.0003 |
  | Editorial writing (up to 500 words, length varies by content) | €0.005–0.014 |
  | Template header | €0.000 |
  | Image storage | €0.001 |
  | **Total** | **~€0.025** |

  ### Per Post — WhatsApp Submission (Phase 2 Generated Headers)

  | Stage | Cost |
  |---|---|
  | All above except header | €0.025 |
  | DALL-E 3 HD header | €0.074 |
  | **Total** | **~€0.099** |

  ### Per Post — RSS Feed Article

  | Stage | Cost |
  |---|---|
  | Geographic relevance check | €0.001 |
  | Tone + extraction | €0.0003 |
  | Article writing (up to 300 words, length varies by content) | €0.004–0.010 |
  | Template header | €0.000 |
  | **Total** | **~€0.015** |

  ### Monthly Running Costs at Typical Volume

  | Volume | AI costs | Hosting | Total estimate |
  |---|---|---|---|
  | 5 posts/day | €15 | €20 | ~€35/month |
  | 20 posts/day | €60 | €20 | ~€80/month |
  | 50 posts/day | €150 | €20 | ~€170/month |
  | 100 posts/day | €300 | €20 | ~€320/month |

  ---

  ## Future Features Roadmap

  These features are planned for after the core platform is stable. The architecture supports all of them without changes to the core infrastructure — new content types require only new prompt instructions, a new post type field, and a display template on the website.

  | Feature | Description | Notes |
  |---|---|---|
  | Restaurant & Business Reviews | Community-submitted reviews of Tallaght businesses, aggregated into business profile pages | Tighter moderation thresholds for negative content |
  | Travel Logs | Tallaght residents share experiences from trips and holidays | "Tallaght Travels" section |
  | Bargain Buys | Tips on cheap finds — charity shops, sales, market deals | Auto-archive after 7 days |
  | Lost & Found | Lost pets, items, found wallets and keys | Auto-archive after 14 days |
  | Job Listings | Local employment opportunities | Employer-submitted |
  | Housing / Accommodation | Rooms available, flatmates wanted | Time-limited listings |
  | Gigs & Tickets | Local entertainment, tickets for sale or swap | Event-linked |
  | Sports Results | Full match reports for local clubs | GAA, soccer, rugby |
  | Community Groups Directory | Active groups, meeting times, contact details | Admin-curated |
  | Classifieds | Buy/sell local pre-loved items | Price field, expiry date |
  | Planning Alerts | Community notices about local planning applications | Could supplement council RSS |
  | Contributor "Check My Posts" Expanded | More detailed contributor dashboard via WhatsApp | Submission stats, tips |
  | Multi-area Network | Replicate platform for Clondalkin, Lucan, Ballymun etc. | New instances, shared AI pipeline |

  ---

  ## Deployment Infrastructure

  ### VPS Environment

  The application is deployed to an existing VPS at **185.43.233.219**. This server already hosts another application (GroupWatch) and that must not be interfered with under any circumstances.

  **Existing VPS architecture:**
  - nginx runs as a Docker container and proxies domains to app containers by internal port
  - Each application runs in its own Docker service on its own internal port
  - Cloudflare sits in front and handles HTTPS termination for all domains
  - Deployments happen via GitHub Actions over SSH

  ### Required Files to Produce at Build Time

  | File | Purpose |
  |---|---|
  | \`Dockerfile\` | Builds and runs the application |
  | \`docker-compose.yml\` | Defines the app service on its own internal port |
  | \`deploy/nginx/tallaght-community.conf\` | nginx \`server {}\` block for the new domain only |
  | \`.github/workflows/deploy.yml\` | CI/CD workflow — SSH into VPS, pull image, restart only this service |

  ### Port Allocation

  - GroupWatch occupies port **8080**
  - This application must use **port 8081 or higher**
  - Port must not conflict with any other service on the VPS

  ### docker-compose.yml Rules

  - The app runs as its own named service (e.g. \`tallaght-community\`)
  - Uses its own internal port (8081 or higher)
  - Does **not** modify or reference any other services on the host
  - The deploy workflow must **never** run \`docker compose up -d\` without specifying the service name — always \`docker compose up -d <service-name>\`

  ### GitHub Actions Deploy Workflow

  The deploy workflow must:
  1. SSH into the VPS using repository secrets
  2. Pull only the new app's Docker image
  3. Restart only the new app's Docker service by name
  4. Never touch GroupWatch or any other running service

  **Repository secrets used:**
  - \`VPS_HOST\` — the server IP or hostname
  - \`VPS_USER\` — SSH username
  - \`VPS_SSH_KEY\` — private SSH key for authentication
  - \`GITHUB_TOKEN\` — for pulling the Docker image from GitHub Container Registry

  ### nginx Configuration

  - A \`server {}\` block is provided in \`deploy/nginx/tallaght-community.conf\`
  - This file is **manually merged** into the existing nginx container on the VPS by the owner — the deploy workflow does not touch nginx
  - The config must only define the new domain's server block — no modifications to existing server blocks
  - Cloudflare handles HTTPS — nginx config can accept on port 80 and proxy to the app's internal port

  ### Summary of Hard Rules

  - Do **not** use port 8080 (GroupWatch)
  - Do **not** run \`docker compose up -d\` without specifying the service name
  - Do **not** modify, restart, or reference any other services in docker-compose
  - nginx config is provided as a file for manual application — the deploy pipeline does not touch nginx
  - Cloudflare handles all HTTPS — no SSL certs managed on the VPS directly

  ---

  ## Build Phases

  ### Phase 1 — Foundation
  **Everything depends on this. Must be completed first.**

  **Goal:** Establish the database, API contracts, and code generation so all other components can be built.

  **Deliverables:**
  - Database schema: `contributors`, `submissions`, `posts`, `categories`, `post_categories`, `post_types`, `contributor_bans`, `admin_users`, `admin_invitations`, `golden_examples`, `distribution_log`, `job_queue`, `rss_feeds`, `rss_items`
  - Full OpenAPI specification covering all endpoints: posts CRUD, categories, submissions, contributors, admin, stats/summary
  - Codegen run — React Query hooks and Zod validators generated and available
  - API server health check confirmed working

  **Dependencies:** None

  ---

  ### Phase 2a — Public Website
  **Can be built in parallel with Phase 2b and 2c once Phase 1 is complete.**

  **Goal:** The public-facing community website — the place readers come to browse content.

  **Deliverables:**
  - New website artifact (React + Vite) mounted at root path "/"
  - Home page — live post feed with category filter and search
  - Post detail page — full article, images, contributor credit, source attribution
  - Category pages
  - About / Submit page — WhatsApp number and how to contribute
  - Advertise With Us page — contact form, media kit placeholder
  - Contributors page (empty initially, populated in Phase 4)
  - Real API data throughout — no placeholder content
  - Phase 1 template headers integrated

  **Dependencies:** Phase 1

  ---

  ### Phase 2b — WhatsApp Ingestion & AI Processing Pipeline
  **Can be built in parallel with Phase 2a and 2c once Phase 1 is complete.**

  **Goal:** The core engine — receive WhatsApp messages and turn them into published posts.

  **Deliverables:**
  - Meta WhatsApp Cloud API webhook (POST endpoint + GET verification challenge)
  - All message types handled: text, image, audio/voice
  - Incoming media downloaded to object storage immediately on receipt
  - Contributor profile creation and update on every incoming message
  - Voice transcription via OpenAI Whisper
  - Image content extraction via GPT-4o Vision
  - Processing job queue (database-backed, worker process)
  - 7-stage AI pipeline: safety check → tone → extraction → writing → header assignment
  - Confidence-based routing: auto-publish / hold / reject
  - WhatsApp reply messages for each outcome (confirmation, acknowledgement, follow-up question, rejection)
  - WhatsApp command handling (HELP, MY POSTS, STATUS, DELETE, STOP) — database only, zero AI cost
  - Spam/abuse detection with ban system and escalating durations
  - All processing logged via pino structured logging

  **Dependencies:** Phase 1

  ---

  ### Phase 2c — RSS Ingestion & Geographic Filtering
  **Can be built in parallel with Phase 2a and 2b once Phase 1 is complete.**

  **Goal:** Automated content from official sources, filtered to Tallaght.

  **Deliverables:**
  - RSS feed poller running on a configurable schedule (default 30 minutes)
  - Configurable feed list stored in database, managed via admin dashboard
  - Layer 1 geographic filtering — Tallaght keyword list match (zero cost)
  - Layer 2 geographic filtering — AI relevance check for ambiguous items (GPT-4o-mini)
  - Duplicate detection via item URL
  - RSS items added to same processing queue as WhatsApp submissions
  - Attribution and source link automatically added to all RSS-sourced articles
  - RSS posts auto-published (no moderation queue)
  - Per-feed settings: enabled/disabled, daily post limit, geographic scope override

  **Dependencies:** Phase 1

  ---

  ### Phase 3 — Admin Dashboard
  **Requires Phase 2a (website shell) and Phase 2b (processing pipeline) to be complete.**

  **Goal:** The operator's control panel for moderation, configuration, and oversight.

  **Deliverables:**
  - Secure login (username + password)
  - Email invite system for adding additional admin users (Resend integration)
  - Roles: Super Admin and Moderator
  - Moderation queue: original message + AI draft + confidence score + contributor info
  - Approve / reject / edit-then-approve post actions
  - Star rating per post (feeds golden examples library)
  - Contributor list with masked phone numbers, submission history, ban management
  - RSS feed management UI (add/remove, enable/disable, per-feed settings)
  - Processing queue status display (pending / processing / done / failed)
  - Failed job management with manual retry
  - Category management (create, merge, reassign, reorder)
  - Geographic coverage settings (editable place name list)
  - Header template library management (upload category templates)
  - Golden examples library viewer (see what the AI is learning from)

  **Dependencies:** Phase 1, Phase 2a, Phase 2b, Phase 2c

  ---

  ### Phase 4 — Social Distribution & Contributor Profiles
  **Can be built once Phase 3 is stable.**

  **Goal:** Amplify reach through social media and recognise top contributors.

  **Deliverables:**

  **Social Distribution:**
  - Facebook Page integration via Meta Graph API
  - Instagram integration via Instagram Graph API (same Facebook App)
  - Distribution triggered on every publish (auto and manual)
  - Distribution status tracked per post in the database
  - One automatic retry on failure
  - Distribution status visible in admin dashboard

  **Contributor Profiles:**
  - Threshold detection — auto-message contributors who reach 5+ published posts
  - Profile submission flow — name, bio, selfie via WhatsApp
  - Contributor profile pages on the website
  - "Meet Our Contributors" section on the website
  - All contributor articles linked from their profile page

  **Dependencies:** Phase 1, Phase 2a, Phase 2b, Phase 3

  ---

  ### Phase 5 — Extended Content Types (Future)
  **Each item in this phase is independent and can be prioritised separately.**

  **Goal:** Expand the platform beyond news and events into a full local information hub.

  **Planned additions (in suggested priority order):**
  1. Restaurant & Business Reviews — with aggregated business profile pages
  2. Bargain Buys section — auto-archiving after 7 days
  3. Travel Logs ("Tallaght Travels" section)
  4. Lost & Found — auto-archiving after 14 days
  5. Job Listings
  6. Community Groups Directory
  7. Classifieds (buy/sell)
  8. Sports Results with structured match report format
  9. Housing / Accommodation listings

  **Dependencies:** Phase 4 complete, branding and brand style finalised

  ---

  ### Phase 6 — Network Expansion (Long-Term)
  **Only relevant once the Tallaght platform is stable, profitable, and proven.**

  **Goal:** Replicate the platform model in other Dublin areas and beyond.

  **Approach:**
  - Multi-tenant architecture — each area is a new instance with its own geographic filter, WhatsApp number, RSS feeds, and brand
  - Shared AI pipeline across all instances
  - Centralised admin with per-area moderation teams
  - Combined advertising value of a multi-area local media network

  **Target areas (suggested):** Clondalkin, Lucan, Ballymun, Blanchardstown, Drimnagh, Crumlin

  **Dependencies:** Phase 5, significant traffic and revenue established in Tallaght

  ---

  ## Summary Build Order

  ```
  Phase 1: Foundation (database + API)
      ↓
  Phase 2a: Public Website   ←→   Phase 2b: WhatsApp Pipeline   ←→   Phase 2c: RSS Ingestion
      (all three in parallel)
      ↓
  Phase 3: Admin Dashboard
      ↓
  Phase 4: Social Distribution + Contributor Profiles
      ↓
  Phase 5: Extended Content Types (one at a time, in priority order)
      ↓
  Phase 6: Network Expansion
  ```

  ---

  *This document represents the full planning output from the pre-build planning session. All architectural decisions, cost estimates, and feature specifications are based on the discussions recorded herein. The platform name and brand identity are TBD and will be resolved before Phase 2 website design work begins.*
  