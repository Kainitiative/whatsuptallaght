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
  Newspaper,
  ShieldCheck,
  Users,
  Trophy,
  Building2,
  HeartPulse,
  Home,
  Car,
  ArrowRight,
  CheckCircle2,
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

const NEWS_CATEGORIES = [
  {
    icon: Users,
    label: "Community",
    slug: "community",
    description: "Neighbourhood notices, local campaigns, and residents' stories from across Dublin 24.",
  },
  {
    icon: Trophy,
    label: "Sport",
    slug: "sport",
    description: "Shamrock Rovers, GAA, athletics, and every local club keeping Tallaght active.",
  },
  {
    icon: Building2,
    label: "Business",
    slug: "business",
    description: "New openings, local services, and The Square — your high street updates.",
  },
  {
    icon: HeartPulse,
    label: "Health",
    slug: "health",
    description: "Tallaght University Hospital, GP services, mental health and wellbeing resources.",
  },
  {
    icon: Home,
    label: "Housing",
    slug: "housing",
    description: "Rent, new developments, social housing and planning across South Dublin.",
  },
  {
    icon: Car,
    label: "Transport",
    slug: "transport",
    description: "Luas Red Line, bus routes, road closures and parking in Dublin 24.",
  },
];

export default function TallaghtNewsPage() {
  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const displayNumber = config?.whatsappNumber ?? null;
  const waNumber = displayNumber ? toWaNumber(displayNumber) : null;
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  const { data: latestPosts, isLoading } = useListPosts(
    { status: "published", limit: 6 },
    { query: { queryKey: getListPostsQueryKey({ status: "published", limit: 6 }) } }
  );

  return (
    <>
    <Helmet>
      <title>Tallaght News – Latest Local Stories | What's Up Tallaght</title>
      <meta name="description" content="The latest news from Tallaght, Dublin — community updates, local stories, and breaking news submitted by residents and sourced from local organisations." />
      <meta property="og:title" content="Tallaght News – Latest Local Stories | What's Up Tallaght" />
      <meta property="og:description" content="The latest news from Tallaght, Dublin — community updates and local stories." />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />

      {/* Hero */}
      <section className="bg-card border-b py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <Newspaper className="w-4 h-4" />
            Dublin 24 · Tallaght
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            Tallaght News,<br />
            <span className="text-primary">straight from the community.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10">
            What's Up Tallaght is the only local news source built entirely by residents. Stories are submitted by WhatsApp, verified by AI, and published within minutes — no journalists, no paywalls.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-[#25D366] hover:bg-[#20B954] text-white rounded-full font-bold h-14 px-8 text-lg shadow-md">
                  <MessageCircle className="w-5 h-5 mr-3" />
                  Submit a Story
                </Button>
              </a>
            ) : null}
            <Link href="/">
              <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg">
                Read Latest News
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Latest stories */}
      <section className="py-16 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Latest Tallaght News</h2>
            <Link href="/" className="text-primary font-semibold flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : (latestPosts?.posts?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestPosts!.posts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">No articles yet — be the first to submit!</p>
          )}
        </div>
      </section>

      {/* News categories */}
      <section className="bg-muted py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">
            Tallaght news by topic
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto text-lg">
            From Shamrock Rovers to Tallaght University Hospital, we cover everything that matters to Dublin 24.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {NEWS_CATEGORIES.map(({ icon: Icon, label, slug, description }) => (
              <Link key={slug} href={`/category/${slug}`}>
                <div className="bg-card rounded-2xl p-6 border border-border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How WUT works */}
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
            How Tallaght gets its news
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto text-lg">
            Traditional local newspapers have been closing across Ireland. What's Up Tallaght fills that gap using the technology everyone already has in their pocket.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-3">1. WhatsApp it to us</h3>
              <p className="text-muted-foreground">
                Spotted something in Tallaght? Send a text, photo, or voice note to our WhatsApp number. No account needed, no form to fill in.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-3">2. AI verifies & writes</h3>
              <p className="text-muted-foreground">
                Our AI pipeline checks for accuracy, formats the story professionally, and adds relevant context — all within minutes of your message.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-6">
                <Newspaper className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Published for Tallaght</h3>
              <p className="text-muted-foreground">
                Your story goes live on whatsuptallaght.ie and is shared on social media — reaching thousands of Dublin 24 residents instantly.
              </p>
            </div>
          </div>
          <div className="mt-12 text-center">
            <Link href="/about">
              <Button variant="outline" className="rounded-full h-12 px-8">
                Learn more about how it works
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* What we cover */}
      <section className="bg-card border-t border-b py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">
                What counts as Tallaght news?
              </h2>
              <ul className="space-y-5">
                {[
                  { title: "Anything happening in Dublin 24", desc: "Tallaght, Firhouse, Knocklyon, Templeogue, Rathfarnham — if it's in D24, we cover it." },
                  { title: "Community events big or small", desc: "A local litter pick counts just as much as a festival. Every story matters." },
                  { title: "Sport at every level", desc: "From Shamrock Rovers fixtures to your under-12s winning the cup on Saturday morning." },
                  { title: "Local business and services", desc: "New café opening? Road closed for works? Bin collection changed? That's news here." },
                  { title: "Issues that affect residents", desc: "Planning applications, hospital waiting times, housing disputes — things your neighbours need to know." },
                ].map(({ title, desc }) => (
                  <li key={title} className="flex gap-4">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground mb-0.5">{title}</strong>
                      <span className="text-muted-foreground text-sm">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-muted rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-3 text-foreground">Got a story?</h3>
              <p className="text-muted-foreground mb-6">
                Send it to us on WhatsApp right now. It takes 30 seconds and you could be published within minutes.
              </p>
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20B954] text-white rounded-full font-bold h-14 text-lg shadow-sm">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {displayNumber ? `Message ${displayNumber}` : "Open WhatsApp"}
                  </Button>
                </a>
              ) : (
                <Button size="lg" disabled className="w-full rounded-full font-bold h-14 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Open WhatsApp
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Free to use · No account required · Stories reviewed by editors
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Internal link to community guide */}
      <section className="py-16 container mx-auto px-4 max-w-4xl text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
          New to Tallaght?
        </h2>
        <p className="text-muted-foreground text-lg mb-8">
          Get to know the area — its history, key landmarks, community groups and more in our complete Tallaght guide.
        </p>
        <Link href="/tallaght-community">
          <Button variant="outline" size="lg" className="rounded-full h-14 px-8 text-lg">
            Explore the Tallaght Community Guide
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </section>
    </div>
    </>
  );
}
