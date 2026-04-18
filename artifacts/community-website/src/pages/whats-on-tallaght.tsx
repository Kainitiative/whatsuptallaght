import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  useListPosts,
  getListPostsQueryKey,
  useListCategories,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { CategoryFilter } from "@/components/category-filter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Clock,
  Tag,
  MessageCircle,
  ArrowRight,
  Music,
  Trophy,
  Palette,
  Users,
  Star,
  ExternalLink,
} from "lucide-react";

interface PublicConfig {
  whatsappNumber: string | null;
  platformName: string;
  platformUrl: string | null;
}

interface PublicEvent {
  id: number;
  title: string;
  eventDate: string;
  eventTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  organiser: string | null;
  price: string | null;
  websiteUrl: string | null;
  status: string;
  articleSlug: string | null;
  articleHeaderImageUrl: string | null;
  submissionSource: "whatsapp" | "rss" | null;
}

interface EventsResponse {
  events: PublicEvent[];
  total: number;
  totalPages: number;
  weekendRange?: { saturday: string; sunday: string };
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

function formatEventDate(dateStr: string): { day: number; month: string; weekday: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IE", { month: "short" }),
    weekday: d.toLocaleDateString("en-IE", { weekday: "long" }),
  };
}

const EVENT_TYPES = [
  { icon: Music, label: "Music & Gigs", desc: "Live bands, concerts, and open mic nights across Tallaght and South Dublin." },
  { icon: Trophy, label: "Sport & Fitness", desc: "Match days at Tallaght Stadium, fun runs, GAA, and community fitness events." },
  { icon: Palette, label: "Arts & Culture", desc: "Exhibitions, theatre, and workshops at RUA RED and Civic Theatre." },
  { icon: Users, label: "Community", desc: "Litter picks, neighbourhood meetings, fundraisers, and social gatherings." },
  { icon: Star, label: "Family & Kids", desc: "School events, youth clubs, playgrounds, and family-friendly activities." },
  { icon: Calendar, label: "Festivals", desc: "Annual favourites — Tallafest, Red Line Book Festival, St. Patrick's Day Parade." },
];

import { useQuery } from "@tanstack/react-query";

export default function WhatsOnTallaghtPage() {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const displayNumber = config?.whatsappNumber ?? null;
  const waNumber = displayNumber ? toWaNumber(displayNumber) : null;
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  // Resolve events category slug dynamically
  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });
  const eventsCategory = categories?.find(
    (c) => c.name.toLowerCase().includes("event") || c.name.toLowerCase().includes("what's on")
  );

  // Event articles
  const { data: eventArticles, isLoading: articlesLoading } = useListPosts(
    { status: "published", categorySlug: eventsCategory?.slug, limit: 9 },
    {
      query: {
        enabled: !!eventsCategory?.slug,
        queryKey: getListPostsQueryKey({
          status: "published",
          categorySlug: eventsCategory?.slug,
          limit: 9,
        }),
      },
    }
  );

  // Upcoming structured events
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setEventsLoading(true);
      try {
        const res = await fetch(`${BASE}/api/public/events?status=upcoming&page=1`);
        if (!res.ok) throw new Error();
        const data: EventsResponse = await res.json();
        setUpcomingEvents(data.events.slice(0, 5));
      } catch {
        setUpcomingEvents([]);
      } finally {
        setEventsLoading(false);
      }
    }
    load();
  }, [BASE]);

  return (
    <>
    <Helmet>
      <title>What's On in Tallaght – Events & Activities | What's Up Tallaght</title>
      <meta name="description" content="Find out what's on in Tallaght, Dublin. Upcoming events, activities, classes, and things to do near you — updated daily from the local community." />
      <meta property="og:title" content="What's On in Tallaght – Events & Activities | What's Up Tallaght" />
      <meta property="og:description" content="Find out what's on in Tallaght — events, activities and things to do updated daily." />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />

      {/* Hero */}
      <section className="bg-card border-b py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <Calendar className="w-4 h-4" />
            Events · Dublin 24
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            What's On<br />
            <span className="text-primary">in Tallaght</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10">
            Your guide to events, activities, and things to do in Tallaght and Dublin 24 — submitted by local residents and updated daily.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/events">
              <Button size="lg" className="rounded-full font-bold h-14 px-8 text-lg shadow-md">
                <Calendar className="w-5 h-5 mr-2" />
                Full Events Calendar
              </Button>
            </Link>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Submit an Event
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Upcoming events strip */}
      <section className="py-14 bg-muted border-b">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Coming up in Tallaght</h2>
            <Link href="/events" className="text-primary font-semibold flex items-center gap-1 hover:underline text-sm">
              Full calendar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-10 bg-card rounded-2xl border border-border">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No upcoming events yet — be the first to add one!</p>
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <Button className="rounded-full bg-[#25D366] hover:bg-[#20B954] text-white h-10 px-6">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp us your event
                  </Button>
                </a>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const { day, month, weekday } = formatEventDate(event.eventDate);
                return (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden flex"
                  >
                    <div className="flex-shrink-0 flex flex-col items-center justify-center bg-primary/5 border-r border-border px-4 py-4 min-w-[72px]">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">{month}</span>
                      <span className="text-2xl font-bold text-primary leading-tight">{day}</span>
                      <span className="text-xs text-muted-foreground">{weekday.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 p-4 min-w-0">
                      <h3 className="font-semibold text-foreground leading-snug mb-1">{event.title}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {event.eventTime && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" /> {event.eventTime}{event.endTime ? ` – ${event.endTime}` : ""}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" /> {event.location}
                          </span>
                        )}
                        {event.price && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="w-3 h-3" /> {event.price}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-1">{event.description}</p>
                      )}
                    </div>
                    <div className="flex items-center pr-4 shrink-0 gap-2">
                      {event.articleSlug && (
                        <Link href={`/article/${event.articleSlug}`}>
                          <span className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Read →</span>
                        </Link>
                      )}
                      {event.websiteUrl && (
                        <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 text-center">
                <Link href="/events">
                  <Button variant="outline" className="rounded-full h-10 px-6">
                    See all upcoming events <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Event articles */}
      <section className="py-16 container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Event stories from the community</h2>
            <p className="text-muted-foreground mt-1">Written by Tallaght residents, for Tallaght residents</p>
          </div>
          {eventsCategory?.slug && (
            <Link href={`/category/${eventsCategory.slug}`} className="text-primary font-semibold flex items-center gap-1 hover:underline text-sm shrink-0">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {articlesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (eventArticles?.posts?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventArticles!.posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted rounded-2xl border border-border">
            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No event stories yet</p>
            <p className="text-muted-foreground mb-6">Know about something happening in Tallaght? Send it to us.</p>
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

      {/* Types of events */}
      <section className="bg-muted py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">
            Things to do in Tallaght
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto text-lg">
            From match days at Tallaght Stadium to festivals at RUA RED — there's always something on in Dublin 24.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EVENT_TYPES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-card rounded-2xl p-6 border border-border hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Submit CTA */}
      <section className="py-16 container mx-auto px-4 max-w-3xl text-center">
        <MessageCircle className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
          Organising something in Tallaght?
        </h2>
        <p className="text-muted-foreground text-lg mb-8">
          Send us the details on WhatsApp and we'll add your event to the calendar and publish a story about it — completely free, within minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noreferrer">
              <Button size="lg" className="rounded-full bg-[#25D366] hover:bg-[#20B954] text-white h-14 px-8 text-lg font-bold shadow-md">
                <MessageCircle className="w-5 h-5 mr-2" />
                {displayNumber ? `WhatsApp ${displayNumber}` : "Submit your event"}
              </Button>
            </a>
          ) : null}
          <Link href="/events">
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg">
              Browse all events
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-5">Free · No account needed · Usually live within minutes</p>
      </section>

      {/* Internal links */}
      <section className="border-t py-12 container mx-auto px-4 max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/tallaght-news">
            <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group text-center">
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">Tallaght News</h3>
              <p className="text-sm text-muted-foreground">Latest headlines from Dublin 24</p>
            </div>
          </Link>
          <Link href="/tallaght-community">
            <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group text-center">
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">Community Guide</h3>
              <p className="text-sm text-muted-foreground">Landmarks, history & local life</p>
            </div>
          </Link>
          <Link href="/about">
            <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group text-center">
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">How It Works</h3>
              <p className="text-sm text-muted-foreground">WhatsApp → Article in minutes</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
    </>
  );
}
