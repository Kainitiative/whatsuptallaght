import { db } from "@workspace/db";
import { categoriesTable, postsTable, contributorsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";

const CATEGORIES = [
  { name: "Events & What's On", slug: "events", color: "#C0392B", description: "Local events, gigs, markets, and things happening around Tallaght" },
  { name: "Community & Notices", slug: "community", color: "#27AE60", description: "Community news, notices, lost and found, local announcements" },
  { name: "Sport", slug: "sport", color: "#2980B9", description: "Local sports news, GAA, soccer, athletics and more" },
  { name: "Business & Local Services", slug: "business", color: "#D68910", description: "Local business news, new openings, services and commerce" },
  { name: "News & Issues", slug: "news", color: "#2C3E50", description: "Local and national news affecting the Tallaght community" },
];

const CONTRIBUTORS = [
  { displayName: "Maria", area: "Jobstown", phoneHash: "demo_hash_001" },
  { displayName: "Ciarán", area: "Tallaght Village", phoneHash: "demo_hash_002" },
  { displayName: "Aoife", area: "Belgard", phoneHash: "demo_hash_003" },
  { displayName: "Derek", area: "Fortunestown", phoneHash: "demo_hash_004" },
];

const DEMO_POSTS = [
  {
    title: "Luas Red Line Weekend Closure: What You Need to Know",
    slug: "luas-red-line-weekend-closure",
    excerpt: "Transdev has confirmed a full suspension of Luas Red Line services between Belgard and Tallaght this Saturday and Sunday for essential track maintenance works.",
    body: `Transdev has confirmed a full suspension of Luas Red Line services between Belgard and Tallaght this Saturday and Sunday for essential track maintenance works. Services will be suspended from 7am on Saturday morning through to 11pm on Sunday night.

Replacement bus services operated by Dublin Bus will run every 12 minutes along the Luas corridor, calling at all tram stops. Passengers are advised to allow an additional 20 minutes journey time due to road traffic on the N81.

The works are part of an ongoing track renewal programme on the Red Line and form part of Transport for Ireland's multi-year investment in the network.

Commuters travelling to the city centre are advised to consider using the 49 or 65 bus services as alternatives, both of which run frequent services from Tallaght Town Centre to the city via the Red Cow interchange.

For real-time updates, passengers can check the TFI Live app or follow Transdev Ireland on social media.`,
    categorySlug: "news",
    isFeatured: true,
    hoursAgo: 2,
  },
  {
    title: "Tallaght Harriers AC Win County Cross Country Championship",
    slug: "tallaght-harriers-county-cross-country",
    excerpt: "Tallaght Harriers Athletic Club brought home the South Dublin County Cross Country Championship title last Sunday, with outstanding performances across all age categories at Tymon Park.",
    body: `Tallaght Harriers Athletic Club brought home the South Dublin County Cross Country Championship title last Sunday, with outstanding performances across all age categories at Tymon Park.

The club's senior men's team, led by captain Declan Farrell from Jobstown, took first place in the team event. Farrell himself crossed the line in third place overall in the individual standings.

On the women's side, Niamh Collins delivered a superb performance to finish second in the senior women's race.

Club chairperson Brendan Murphy said he was absolutely thrilled with the result. "The commitment these athletes put in, week in and week out, is incredible. Today was their reward."

Training continues every Tuesday and Thursday evening at the Tallaght Track. New members are always welcome — details at tallaghtharriers.ie.`,
    categorySlug: "sport",
    isFeatured: false,
    hoursAgo: 6,
  },
  {
    title: "New Community Garden Opens in Fettercairn — Volunteers Needed",
    slug: "new-community-garden-fettercairn",
    excerpt: "A brand new community garden has opened on Fettercairn Road, backed by South Dublin County Council's community development fund.",
    body: `A brand new community garden has opened on Fettercairn Road, backed by South Dublin County Council's community development fund. The project officially opened last week with a gathering of local residents and council representatives.

The garden features twelve raised vegetable beds, a wildflower meadow section, and a seating area made entirely from reclaimed timber. All produce grown will be shared among participating households.

Project coordinator Siobhán Whelan, a Fettercairn resident of twenty years, said the garden had already exceeded expectations. "We had thirty people turn up on the first morning. Families, older people, young people — everyone mixed in together."

Volunteers are needed every Saturday morning from 10am to 12pm for general maintenance. No experience is necessary — tools and guidance are provided.

To get involved, contact the Fettercairn Community Association via their Facebook page or call into the Killinarden Community Centre on Tuesday afternoons.`,
    categorySlug: "community",
    isFeatured: false,
    hoursAgo: 10,
  },
  {
    title: "Tallaght Summer Festival 2026 — Full Programme Announced",
    slug: "tallaght-summer-festival-2026",
    excerpt: "The full programme for this year's Tallaght Summer Festival has been announced, with over forty events taking place across six weekends — all free and open to the public.",
    body: `The full programme for this year's Tallaght Summer Festival has been announced, with over forty events taking place across six weekends between June and August. All events are free and open to the public.

The opening weekend will feature a street concert at The Square, headlined by local band The Walkinstown Lights, followed by a family fun day at Tymon Park with live music, food trucks, and children's activities.

Festival highlights include:

Music in the Square — A series of free outdoor concerts every Saturday evening throughout July, featuring a mix of local and national acts.

Tallaght Food Fair — A full weekend dedicated to local food producers, restaurants, and street food vendors at the Old Bawn Community Centre.

GAA Family Day — Ballyboden St Enda's and Kiltipper United are joining forces for a family sports day at Tymon Bawn playing fields, with coaching sessions for all ages.

Full programme details are available at tallaghtfestival.ie. Organisers are also seeking volunteers — see the website for details.`,
    categorySlug: "events",
    isFeatured: true,
    hoursAgo: 14,
  },
  {
    title: "New Bakery Opens on Main Street — Meet the Baker Behind It",
    slug: "new-bakery-main-street-tallaght",
    excerpt: "Tallaght Town Centre has a new addition — Hanafin's Bakery opened its doors on Main Street this week, the result of a decade of planning by local baker Seamus Hanafin from Knockmore.",
    body: `Tallaght Town Centre has a new addition — Hanafin's Bakery opened its doors on Main Street this week, the result of a decade of planning by local baker Seamus Hanafin from Knockmore.

Seamus, who trained at DIT's Cathal Brugha Street and later spent six years working in bakeries in Cork and Edinburgh, says he always planned to come home to Tallaght and open something of his own. "I grew up here. Everything I've learned was always with the plan to bring it back."

The bakery specialises in sourdough bread and traditional Irish pastries, with a small selection of cakes made fresh each morning.

"Tallaght has changed a lot since I grew up here, and it keeps changing. I just want to be part of what's good about it."

Hanafin's Bakery is at 14 Main Street, Tallaght Town Centre. Open Tuesday to Sunday from 7am.`,
    categorySlug: "business",
    isFeatured: false,
    hoursAgo: 22,
  },
  {
    title: "Planning Application for 340 Homes at Kilnamanagh Submitted",
    slug: "planning-340-homes-kilnamanagh",
    excerpt: "A planning application has been submitted to South Dublin County Council for a major residential development on lands at Kilnamanagh Road, proposing 340 homes across houses and apartments.",
    body: `A planning application has been submitted to South Dublin County Council for a major residential development on lands at Kilnamanagh Road. The scheme proposes 340 homes across a mix of houses, duplexes, and apartments on a site of approximately 6.5 hectares.

The development, proposed by Millgate Homes Limited, would include 85 three-bedroom houses, 120 two-bedroom apartments, and 135 one-bedroom units. The application also includes proposals for a small retail unit, a crèche, and public open space.

Under the Part V affordable housing requirement, 51 of the units would be reserved for social and affordable housing.

Local residents have raised concerns about traffic management on Kilnamanagh Road and the capacity of local schools to absorb additional families. The Kilnamanagh Residents' Association has indicated it will make a formal submission.

The application reference is SD26/0412 and can be viewed on the council's planning portal. Submissions from the public are open for four weeks from the date of validation.`,
    categorySlug: "news",
    isFeatured: false,
    hoursAgo: 30,
  },
  {
    title: "Tallaght FC Under-16s Reach Leinster Cup Final",
    slug: "tallaght-fc-under-16-leinster-cup-final",
    excerpt: "Tallaght FC's under-16 side produced a stunning 3-1 comeback victory over St Kevin's Boys last Saturday to book their place in the Leinster Junior Cup final.",
    body: `Tallaght FC's under-16 side produced a stunning 3-1 comeback victory over St Kevin's Boys last Saturday to book their place in the Leinster Junior Cup final, to be played in May.

Going into half-time a goal down after a well-taken Kevin's opener, Tallaght emerged transformed in the second half. Substitute Jamie Reilly levelled matters ten minutes after the break, before Ryan Dempsey — a Kilnamanagh native in his first season — put Tallaght ahead with a powerful strike from outside the box.

The decisive third came in the final moments from defender Conal Brady, who bundled home a corner to send the supporters into celebrations.

Manager Paul Sheridan praised the character shown by the squad. "At half-time I told them — believe in what you've been doing in training all season. They delivered. I'm incredibly proud of every one of them."

The final will be played at Pearse Park on the first Saturday in May, with kick-off at 2pm.`,
    categorySlug: "sport",
    isFeatured: false,
    hoursAgo: 38,
  },
  {
    title: "Community Alert: Car Break-Ins Reported in Firhouse Area",
    slug: "community-alert-car-breakins-firhouse",
    excerpt: "An Garda Síochána is appealing for information following a series of car break-ins reported in the Firhouse and Templeogue area over the past week. Residents are advised to ensure valuables are not left in vehicles.",
    body: `An Garda Síochána is appealing for information following a series of car break-ins reported in the Firhouse and Templeogue area over the past week. Seven incidents have been confirmed, with additional reports still being assessed.

Incidents occurred mainly between 11pm and 3am, with vehicles targeted on residential streets including Firhouse Road, Cypress Avenue, and several of the close developments off the main road.

In most cases, windows were smashed and items including bags, sat-navs, and loose change were taken.

Gardaí from Tallaght Garda Station advise residents to remove all valuables from vehicles, ensure vehicles are locked and windows fully closed, and report any suspicious activity immediately on 999 or 112.

Anyone with information is asked to contact Tallaght Garda Station at 01 666 6000 or the Garda Confidential Line at 1800 666 111.`,
    categorySlug: "community",
    isFeatured: false,
    hoursAgo: 48,
  },
];

export async function seedDemoContent(): Promise<void> {
  // Only seed if posts table is empty
  const [{ total }] = await db.select({ total: count() }).from(postsTable);
  if (Number(total) > 0) return;

  // Seed categories
  const categoryMap: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const [created] = await db
      .insert(categoriesTable)
      .values(cat)
      .onConflictDoUpdate({ target: categoriesTable.slug, set: { color: cat.color } })
      .returning();
    categoryMap[cat.slug] = created.id;
  }

  // Seed contributors
  const contributorIds: number[] = [];
  for (const contrib of CONTRIBUTORS) {
    const [created] = await db
      .insert(contributorsTable)
      .values({
        phoneHash: contrib.phoneHash,
        displayName: contrib.displayName,
        area: contrib.area,
        submissionCount: Math.floor(Math.random() * 12) + 3,
        isVerified: false,
        isBanned: false,
      })
      .onConflictDoUpdate({ target: contributorsTable.phoneHash, set: { displayName: contrib.displayName } })
      .returning();
    contributorIds.push(created.id);
  }

  // Seed posts
  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const post = DEMO_POSTS[i];
    const publishedAt = new Date(Date.now() - post.hoursAgo * 3600000);

    await db.insert(postsTable).values({
      title: post.title,
      slug: post.slug,
      body: post.body,
      excerpt: post.excerpt,
      status: "published",
      isFeatured: post.isFeatured,
      isSponsored: false,
      primaryCategoryId: categoryMap[post.categorySlug],
      wordCount: post.body.split(/\s+/).length,
      publishedAt,
      confidenceScore: "0.92",
    }).onConflictDoNothing();
  }
}
