# What's Up Tallaght — How the Platform Works

**whatsuptallaght.ie** | Community news for Tallaght, Dublin, powered by WhatsApp and AI.

---

## What It Is

What's Up Tallaght (WUT) is a local news platform for Tallaght, Dublin. The idea is simple: anyone in the community can send a message, photo, voice note, or video to a WhatsApp number, and within minutes a properly written news article appears on the website — automatically.

There are no journalists. No editorial team sitting at desks. The AI handles writing, checking, and publishing. A small admin panel lets the team review anything the AI isn't confident about before it goes live.

Articles are also automatically shared to the WUT Facebook Page when published.

---

## Who Runs It

The platform is managed through an admin dashboard at **whatsuptallaght.ie/admin**. From there, the team can:

- Review articles the AI wasn't sure about before they go live
- Edit or reject any article
- Manage RSS news sources
- See how much the AI is costing each month
- Upload golden example articles to teach the AI the preferred style
- Manage community contributors and event listings

---

## How a Story Gets Published

### 1. Someone sends a WhatsApp message

A community member sends a message to the WUT WhatsApp number. This can be:

- A text message describing something happening
- A photo (with or without a caption)
- A voice note
- A combination of all three

### 2. Safety check (automatic, free)

Before anything else, the AI checks the message against OpenAI's content policy. If it contains anything harmful — hate speech, graphic content, threats — it is immediately rejected and the sender is notified. This step costs nothing.

### 3. Media is processed

- **Voice notes** are transcribed to text using OpenAI Whisper
- **Photos** are described in detail by the AI — it reads any text in the photo, identifies people, places, and context, and produces a written description
- Photos sent by the community are stored and shown at the bottom of the published article ("Photos from the community") — they are never used as the article's main header image

### 4. Tone classification

The AI reads all the text (message + voice transcript + photo description) and decides what kind of story this is:

| Type | Example |
|---|---|
| News | Road closure, planning application, local incident |
| Event | Community fair, workshop, sports match |
| Sport | Match result, club announcement |
| Community | General notice, local initiative |
| Business | New shop opening, local business update |
| Warning | Flooding, fire, safety notice |
| Memorial | Local passing, tribute |

### 5. Information extraction

The AI pulls out the key facts:

- Headline (max 12 words, factual, no clickbait)
- Location (specific area in Tallaght or Dublin)
- Date/time (if mentioned)
- Up to 5 key facts
- Whether the submission has enough information to be published

The completeness check scores four specific things:

| Criterion | Score |
|---|---|
| Mentions a specific place or venue | 0.25 |
| Mentions a date or time | 0.25 |
| Clear subject (who or what the story is about) | 0.25 |
| Something useful to the reader | 0.25 |

### 6. Article writing

The AI rewrites the submission into a clean, readable news article. Strict rules govern this:

- **Only facts from the submission are used.** The AI cannot add context, background, or anything not explicitly stated.
- **Names are reproduced exactly.** If the submission says "John from Jobstown", the article says "John from Jobstown" — not "John Smith" or "local resident John".
- **Length matches the content.** A short notice stays short. A full event gets full coverage. Padding is not allowed.
- **Style is simple and local.** It should read like something a neighbour would share on Facebook — plain language, no formal jargon.
- **The voice note or text is the story.** If a photo and text are both sent, the text leads — the photo is supporting context only.

### 7. Fact-check

After writing, a second AI pass compares the article against the original submission and flags anything that appears in the article but was not in the submission — invented names, numbers, quotes, added context. If anything is flagged, the article is held for human review.

### 8. Confidence score and routing

Each article gets a score from 0 to 1, calculated from:

- Completeness of the submission (50% weight)
- AI confidence in the tone classification (30% weight)
- Word count of the submission (20% weight, capped)

Based on this score, and whether the fact-check passed:

| Score | Fact-check | What happens |
|---|---|---|
| 0.75 or above | PASS | **Auto-published** immediately |
| 0.40 to 0.74 | Any | **Held** — editor reviews before it goes live |
| Below 0.40 | Any | **Rejected** — sender is asked to provide more detail |

### 9. Header image

Every published article gets a wide banner image at the top. This is **never** the photo sent by the community — those go in the body of the article. The header is always purpose-built:

- **Entity images first.** If the article is about a known local entity (like Shamrock Rovers), the platform has a stored image for them and uses it directly — no AI image generation needed.
- **Image library second.** If a similar article has been generated before (same topic keywords, same type), the existing image is reused. One image can be shared across up to 50 articles.
- **DALL·E generation last.** If no suitable image exists, a new one is generated using DALL·E 3 at 1792×1024 pixels (wide cinematic format). The prompt is carefully written to avoid text, signs, logos, and scoreboards — things DALL·E renders poorly.

Image generation costs approximately $0.04 per image and is the main variable cost of running the platform.

### 10. Event record

If the article is about an event, the AI extracts structured event data (date, time, venue, organiser, price, contact info) and creates a calendar entry. This populates the Events section of the website.

### 11. Facebook posting

Auto-published articles are immediately shared to the WUT Facebook Page with a tailored caption written by the AI for social media. The caption is different from the article — shorter, more conversational, suited to Facebook.

### 12. Submitter notification

The sender receives a WhatsApp reply:

- **Published:** "Your story is live!" with a link to the article
- **Held:** "Thanks — it's under review by our editors"
- **Rejected:** "We didn't have enough information — could you add more detail?"

---

## The RSS Pipeline (Automatic News Sources)

Alongside community WhatsApp submissions, the platform also monitors external news sources via RSS feeds (a standard news subscription format). These are checked automatically every 5–60 minutes depending on the source.

### Step 1: Geo filter

Every item from every feed is checked for Tallaght relevance before anything else. An item passes if:

- It comes from a feed that is always local (South Dublin County Council, Shamrock Rovers, The Square), OR
- Its text contains a Tallaght keyword: area names (Belgard, Jobstown, Firhouse, etc.), landmarks (Tallaght Hospital, Tallaght Stadium, The Square), transport routes (Luas Red Line), or the council area

Items that don't mention Tallaght at all are silently skipped — no AI cost.

### Step 2: Events-only filter (optional, per feed)

Each RSS feed can be configured in "Events only" mode. When enabled, an item must contain:

- A **date or time signal**: a day name, month, specific time, "tonight", "this weekend", "doors open", "taking place", etc.
- An **event keyword**: event, show, performance, exhibition, live, concert, festival, workshop, competition, kids event, fun day, "come along", "book now", etc.

Both must be present. This is used for feeds like The Square Shopping Centre, where most posts are general news but some announce events.

### Step 3: AI processing

Items that pass the filters go through a shorter version of the WhatsApp pipeline:

- Safety check
- Tone classification + information extraction
- Rewritten in community voice (shorter, simpler than the source)
- Fact-checked
- Confidence scored

### Step 4: Trust levels

RSS sources have trust tiers that affect whether articles auto-publish:

| Tier | Sources | Behaviour |
|---|---|---|
| Official | South Dublin County Council, Garda, HSE, Transport for Ireland, Met Éireann | High base confidence — more likely to auto-publish |
| News | RTÉ, Dublin Live | Medium base confidence |
| General | Everything else (The Square, Shamrock Rovers, etc.) | Lower base confidence — more likely to be held |

---

## The Website

**whatsuptallaght.ie** is the public-facing site. It has:

- **Homepage** — hero article, "Happening This Weekend" event strip, main article feed, WhatsApp submit prompt
- **Article pages** — wide header image, article body, community photos below the text, related articles
- **Category pages** — Business & Local Services, Community & Notices, Events & What's On, News & Issues, Sport
- **Events page** — structured listings of upcoming events extracted from articles
- **Pillar pages** — SEO-focused pages: `/tallaght-news`, `/tallaght-community`, `/whats-on-tallaght`
- **Contributors page** — profiles of regular community contributors

---

## The Admin Dashboard

**whatsuptallaght.ie/admin** — password protected.

| Section | What it does |
|---|---|
| Dashboard | Live stats — submissions today, published articles, confidence averages |
| Review Queue | Articles held for editor review — approve, edit, or reject |
| Articles | All published and draft articles — edit, delete, regenerate images |
| RSS Feeds | Add, pause, and configure news sources and their filters |
| Events | View and manage the events calendar |
| Categories | Manage article categories |
| Image Library | View all AI-generated header images — see how many times each has been reused, delete any |
| Golden Examples | Upload example articles to teach the AI the preferred writing style |
| Entities | Manage known local entities (clubs, venues, organisations) with stored images |
| Social | View and edit AI-generated Facebook captions before they post |
| Usage | Month-by-month AI cost breakdown — model, stage, tokens, estimated cost |
| Settings | Platform URL, OpenAI key, Facebook credentials, auto-publish toggles |

---

## AI Models Used

| Model | What it does | Approx. cost |
|---|---|---|
| GPT-4o | Article writing, image description, fact-checking | ~$2.50 per 1M words read, $10 per 1M words written |
| GPT-4o-mini | Tone classification, info extraction, event extraction, RSS rewriting, entity context | ~$0.15 per 1M words read |
| Whisper-1 | Voice note transcription | ~$0.006 per minute of audio |
| DALL·E 3 | Header image generation (1792×1024, HD) | $0.04 per image |

Projected steady-state cost: **$3–5 per month** at normal community volume.

---

## Image Rules

The platform follows strict rules to keep images appropriate, accurate, and cost-effective:

1. **Community photos are body images only.** Photos sent via WhatsApp appear below the article text, never as the main header.
2. **Header images are always wide cinematic format** (1792×1024 pixels).
3. **Entity images are reused freely.** Shamrock Rovers articles always get the Rovers crest — no AI generation needed, zero cost.
4. **Asset library reuse.** A generated image can be reused across up to 50 similar articles before a new one is made.
5. **DALL·E prompts block all text.** Every prompt explicitly forbids signs, banners, scoreboards, logos, and any readable text — DALL·E cannot reliably render these and they look broken.
6. **Watermark is applied** to every stored image before it is saved.

---

## Where Everything Lives

| Thing | Location |
|---|---|
| Public website | whatsuptallaght.ie |
| Admin panel | whatsuptallaght.ie/admin |
| Server | VPS at 185.43.233.219 |
| Code repository | github.com/Kainitiative/whatsuptallaght |
| Database | PostgreSQL on the VPS |
| Image storage | Google Cloud Storage (object storage) |
| AI provider | OpenAI |
| CDN / Security | Cloudflare |

---

## Deployment

The platform runs in Docker on the VPS. To deploy new code:

1. Changes are pushed to GitHub
2. SSH into the server
3. Run `docker compose pull && docker compose up -d`
4. The server pulls the latest version, applies any database changes automatically on boot, and restarts

---

## Monetisation Plan

The platform is built to run at near-zero cost (~€3–5/month in AI fees) which means even modest revenue makes it profitable from day one. Below are the revenue streams, roughly in order of ease to implement.

---

### 1. Sponsored Articles — Core Revenue Stream

Local businesses pay to have their announcement published as a clearly labelled sponsored article. It goes through the same AI pipeline, gets the same header image, gets shared to Facebook — it just carries a "Sponsored" label.

**Pricing idea:** €50–€150 per article depending on length and category.

**Who buys this:** The Square, local restaurants, estate agents, gyms, solicitors, dentists, car dealerships — anyone opening, running an event, or promoting a sale.

**Already built:** The `isSponsored` flag exists in the database and the article type. It just needs a submission form and a payment step in front of it.

---

### 2. Display Advertising — Passive Income

Standard banner ads placed on the website. Once the audience is established, local businesses pay a flat monthly fee for a banner on the homepage, sidebar, or article pages.

**Pricing idea:** €100–€300/month for homepage placement, €50–€100/month for run-of-site.

**Who buys this:** Tallaght-area businesses that want consistent visibility — solicitors, financial advisors, car dealerships, takeaways, pharmacies.

**Alternatively:** Google AdSense or a similar automated ad network can fill unsold space passively — low revenue per click but zero effort.

---

### 3. Event Promotion — High Intent Buyers

Event organisers pay to have their event pinned at the top of the Events page or featured in the "Happening This Weekend" strip on the homepage.

**Pricing idea:** €30–€75 to be featured on the homepage this weekend. €20/week to stay pinned on the Events page.

**Who buys this:** Civic Theatre, The Square, local sports clubs, charity events, market organisers, kids' activity providers.

**Why it works:** The person paying already has an event — they have a direct reason to want more eyes on it. It's low friction to sell.

---

### 4. Business Directory Listings

A simple paid directory of local businesses with a profile page, photo, opening hours, phone number, and a link. Businesses submit via WhatsApp the same way community members do — the AI writes the profile.

**Pricing idea:** €99/year for a basic listing, €199/year for a featured listing with priority placement.

**Who buys this:** Tradespeople (plumbers, electricians, painters), beauty salons, takeaways, childcare, tutors — anyone who relies on local word of mouth.

---

### 5. WhatsApp Broadcast Sponsorship

A weekly "What's On in Tallaght This Week" message sent to opted-in WhatsApp subscribers. One sponsored slot per broadcast — the sponsor's event or business mention appears in the message.

**Pricing idea:** €75–€150 per sponsored slot in the broadcast.

**Why it works:** WhatsApp broadcasts have extremely high open rates compared to email. This is a genuinely valuable slot.

---

### 6. Community Grant Funding

WUT is a public good — it provides a free, factual local news service to a community that is otherwise underserved by local media. This qualifies for:

- **South Dublin County Council Community Grants** — SDCC funds local media and community projects
- **Press Council of Ireland / Local Ireland** — supports local news
- **Broadcasting Authority of Ireland (BAI)** — community media funding
- **Local area partnerships** (Tallaght Partnership, Jobstown, Fettercairn) — often fund digital community projects

**Realistic expectation:** €2,000–€10,000/year in grant funding for a project that can demonstrate community reach and impact. Google Analytics data, WhatsApp submission volume, and social media engagement all serve as evidence.

---

### 7. Contributor Tip Jar / Community Support

A simple "Support WUT" button on the site linked to a Stripe or PayPal page. No subscription, no pressure — just an option for people who value the platform to throw in €5 or €10.

**Realistic expectation:** €50–€200/month from a loyal community once the audience is established.

---

## Monetisation Suggestions

These are ideas that would be straightforward to build given how the platform works today.

---

### Suggestion A — "Promote Your Event" Self-Service Page

A page on the public site where any business or organiser can fill in their event details, pay online (Stripe), and have it automatically:

1. Written into an article by the AI
2. Published with a "Promoted Event" label
3. Pinned to the top of the Events page for the duration
4. Shared to the Facebook Page

No human intervention needed. Revenue while you sleep. This is the highest-ROI thing to build next.

---

### Suggestion B — "Advertise With Us" Rate Card Page

The Advertise page already exists in the navigation. Right now it's likely a contact form. Replace it with a proper rate card — clear prices, clear placement options, a simple contact or booking form. Businesses will not enquire unless they know the price. Transparency converts.

---

### Suggestion C — Local Business of the Month

One sponsored slot per month — a business gets a feature article, a pinned homepage card, and a Facebook post. Pitched as a package rather than individual line items.

**Pricing idea:** €250–€400/month for the full package.

**Why it works:** Businesses like clear, simple packages. "Feature article + homepage card + Facebook post" is easy to understand and easy to sell.

---

### Suggestion D — Sponsored Category

A business sponsors an entire category for a month. For example, a gym sponsors the Sport category — their logo appears on every sport article card and the category page.

**Pricing idea:** €200–€500/month per category depending on volume.

---

### Suggestion E — School and Club Newsletters

Local schools and sports clubs send their updates to the WUT WhatsApp number and the AI writes them up as articles. A basic version is free. A premium version (guaranteed same-day publication, priority placement, Facebook share) could be a small paid subscription for the club or school.

**Pricing idea:** €20–€50/month per organisation.

---

### Revenue Projections (Conservative)

| Stream | Monthly estimate |
|---|---|
| 2 sponsored articles | €200 |
| 1 homepage banner ad | €150 |
| 2 promoted events | €100 |
| Grant funding (annualised) | €250 |
| **Total** | **~€700/month** |

At that level, costs are covered many times over and the platform becomes self-sustaining. Scaling to 5–6 sponsored articles/month and 3–4 event promotions pushes monthly revenue past €1,000 without any major effort.

---

*Document generated April 2026. Platform version: live at whatsuptallaght.ie.*
