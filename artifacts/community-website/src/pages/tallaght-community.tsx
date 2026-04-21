import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { CategoryFilter } from "@/components/category-filter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  MapPin,
  Users,
  GraduationCap,
  Dumbbell,
  ShoppingBag,
  Palette,
  Trees,
  HeartPulse,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface PublicConfig {
  whatsappNumber: string | null;
  platformName: string;
  platformUrl: string | null;
}

function toWaNumber(displayNumber: string): string {
  const digits = displayNumber.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length <= 11) return "353" + digits.slice(1);
  return digits;
}

async function fetchPublicConfig(): Promise<PublicConfig> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/public/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

const LANDMARKS = [
  {
    icon: ShoppingBag,
    name: "The Square Tallaght",
    description:
      "One of Ireland's largest shopping centres, anchoring the town centre with over 100 stores, a cinema, restaurants, and weekly community events.",
  },
  {
    icon: Dumbbell,
    name: "Tallaght Stadium",
    description:
      "Home of Shamrock Rovers FC and host to international sport events. The 8,000-capacity ground is one of the finest in Irish football.",
  },
  {
    icon: Palette,
    name: "RUA RED Arts Centre",
    description:
      "South Dublin's flagship arts venue, running galleries, live theatre, music, workshops, and the beloved Red Line Book Festival every October.",
  },
  {
    icon: GraduationCap,
    name: "TU Dublin Tallaght Campus",
    description:
      "Technological University Dublin's Tallaght campus offers degrees, apprenticeships, and evening courses — a key part of the area's educational growth.",
  },
  {
    icon: HeartPulse,
    name: "Tallaght University Hospital",
    description:
      "A major acute hospital serving all of South Dublin and Wicklow, and the future home of the National Children's Hospital on its campus.",
  },
  {
    icon: Trees,
    name: "Tymon Park",
    description:
      "Ireland's second-largest city park, stretching across 260 acres with walking trails, a lake, sports pitches, and playgrounds for all ages.",
  },
  {
    icon: Dumbbell,
    name: "National Basketball Arena",
    description:
      "A state-of-the-art arena in Tallaght that hosts international basketball, concerts, and community sporting events throughout the year.",
  },
  {
    icon: MapPin,
    name: "Saint Mary's Priory",
    description:
      "A Dominican priory in the historic village core of Tallaght, on the site of St. Maelruain's original monastery founded in 769 AD.",
  },
];

const STATS = [
  { value: "81,000+", label: "Residents in Tallaght" },
  { value: "35%", label: "Now hold a third-level qualification (up from 6% in 2001)" },
  { value: "84%", label: "Use public transport regularly" },
  { value: "98%", label: "Value public recreational spaces" },
];

export default function TallaghtCommunityPage() {
  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const displayNumber = config?.whatsappNumber ?? null;
  const waNumber = displayNumber ? toWaNumber(displayNumber) : null;
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  const { data: communityPosts, isLoading } = useListPosts(
    { status: "published", categorySlug: "community", limit: 3 },
    { query: { queryKey: getListPostsQueryKey({ status: "published", categorySlug: "community", limit: 3 }) } }
  );

  return (
    <>
    <Helmet>
      <title>Tallaght Community – Local Groups, Clubs & Initiatives | What's Up Tallaght</title>
      <meta name="description" content="Community news and stories from Tallaght, Dublin. Local clubs, groups, charities, schools and neighbourhood initiatives — all in one place." />
      <link rel="canonical" href="https://whatsuptallaght.ie/tallaght-community" />
      <meta property="og:title" content="Tallaght Community – Local Groups, Clubs & Initiatives | What's Up Tallaght" />
      <meta property="og:description" content="Community news from Tallaght — local clubs, groups, charities and neighbourhood initiatives." />
      <meta property="og:url" content="https://whatsuptallaght.ie/tallaght-community" />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />

      {/* Hero */}
      <section className="bg-card border-b py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <MapPin className="w-4 h-4" />
            Dublin 24 · South Dublin
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            Tallaght Community<br />
            <span className="text-primary">Guide & Local Directory</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10">
            Everything you need to know about Tallaght — from its 1,250-year history to the best parks, sports clubs, arts centres, and how to get involved in the community today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/tallaght-news">
              <Button size="lg" className="rounded-full font-bold h-14 px-8 text-lg shadow-md">
                Read Tallaght News
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Submit a Story
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* About Tallaght */}
      <section className="py-16 md:py-20 container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">About Tallaght</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Tallaght (from the Irish <em>Támh Leacht</em>, meaning "plague burial place") is the county town of South Dublin and the largest settlement in the county, with a population of over 81,000 people according to the 2022 census.
              </p>
              <p>
                The area has one of the longest recorded histories in Ireland. St. Maelruain founded a monastery here in 769 AD — it became so important that it and the monastery at Finglas were called the <strong className="text-foreground">"two eyes of Ireland."</strong> The same location was raided by Vikings in 811 AD and later became the scene of the Battle of Tallaght during the Fenian Rising in March 1867.
              </p>
              <p>
                In the 1960s, Tallaght was a village of just 2,500 people. Rapid urban development transformed it into one of Ireland's most significant towns — making it the <strong className="text-foreground">largest settlement in Ireland without city status.</strong>
              </p>
              <p>
                Today, Tallaght is a diverse, forward-looking community. A landmark 2024 health study by Trinity College Dublin and the HSE found that educational outcomes have seen a near-five-fold improvement since 2001, and the community's fitness levels have risen significantly over the same period.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">Tallaght in numbers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STATS.map(({ value, label }) => (
                <div key={label} className="bg-card rounded-2xl border border-border p-6">
                  <div className="text-3xl font-bold text-primary mb-2">{value}</div>
                  <div className="text-sm text-muted-foreground leading-snug">{label}</div>
                </div>
              ))}
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Source: <strong className="text-foreground">HANA Report 2024</strong> — a 23-year longitudinal study of Tallaght residents by Trinity College Dublin and the HSE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key landmarks */}
      <section className="bg-muted py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">
            Key places in Tallaght
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto text-lg">
            From world-class sport to arts and education — Tallaght punches well above its weight.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LANDMARKS.map(({ icon: Icon, name, description }) => (
              <div key={name} className="bg-card rounded-2xl p-5 border border-border hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-sm">{name}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community news feed */}
      <section className="py-16 container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Latest community news</h2>
          <Link href="/category/community" className="text-primary font-semibold flex items-center gap-1 hover:underline text-sm">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (communityPosts?.posts?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {communityPosts!.posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-6">No community stories yet — be the first to submit one.</p>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <Button className="rounded-full bg-[#25D366] hover:bg-[#20B954] text-white h-12 px-8">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Submit via WhatsApp
                </Button>
              </a>
            ) : null}
          </div>
        )}
      </section>

      {/* Getting involved CTA */}
      <section className="bg-card border-t border-b py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Be part of the Tallaght story
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                What's Up Tallaght exists because local people care about their community. Every story submitted — whether it's a planning notice, a match result, or a community clean-up — helps keep Tallaght informed and connected.
              </p>
              <ul className="space-y-3">
                {[
                  "Submit stories by WhatsApp in seconds",
                  "No account or sign-up needed",
                  "Published contributors are credited by name",
                  "Your story reaches thousands of Dublin 24 residents",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-muted rounded-2xl p-8 text-center">
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Join the community</h3>
              <p className="text-muted-foreground mb-6 text-sm">
                Send us your story, event, or notice and it could be live within minutes.
              </p>
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20B954] text-white rounded-full font-bold h-14 text-lg shadow-sm">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {displayNumber ? `WhatsApp ${displayNumber}` : "Open WhatsApp"}
                  </Button>
                </a>
              ) : (
                <Button size="lg" disabled className="w-full rounded-full font-bold h-14 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Open WhatsApp
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Free · Instant · No account needed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Internal link to news */}
      <section className="py-16 container mx-auto px-4 max-w-4xl text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
          Stay up to date
        </h2>
        <p className="text-muted-foreground text-lg mb-8">
          Read the latest Tallaght news — updated every time a community member submits a story.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/tallaght-news">
            <Button size="lg" className="rounded-full h-14 px-8 text-lg">
              Today's Tallaght News
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/events">
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg">
              What's On in Tallaght
            </Button>
          </Link>
        </div>
      </section>
    </div>
    </>
  );
}
