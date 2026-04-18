import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Calendar, MapPin, Clock, Tag, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicEvent {
  id: number;
  title: string;
  eventDate: string;
  eventTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  organiser: string | null;
  price: string | null;
  websiteUrl: string | null;
  status: string;
  articleId: number | null;
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

type FilterMode = "upcoming" | "weekend" | "past";

function formatEventDate(dateStr: string): { day: number; month: string; weekday: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IE", { month: "short" }),
    weekday: d.toLocaleDateString("en-IE", { weekday: "long" }),
  };
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IE", {
    weekday: "short", day: "numeric", month: "long",
  });
}

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: "upcoming", label: "All Upcoming" },
  { key: "weekend", label: "This Weekend" },
  { key: "past", label: "Past Events" },
];

export default function EventsPage() {
  const [filter, setFilter] = useState<FilterMode>("upcoming");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [weekendRange, setWeekendRange] = useState<{ saturday: string; sunday: string } | null>(null);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function load(f: FilterMode, p: number) {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/public/events?status=${f}&page=${p}`);
      if (!res.ok) throw new Error();
      const data: EventsResponse = await res.json();
      setEvents(data.events);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setWeekendRange(data.weekendRange ?? null);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(filter, page); }, [filter, page]);

  function switchFilter(f: FilterMode) {
    setFilter(f);
    setPage(1);
  }

  const emptyMessage = {
    upcoming: { title: "No upcoming events", hint: "Know about an event in Tallaght? Let us know!" },
    weekend: { title: "Nothing on this weekend", hint: "Know about a weekend event? Let us know!" },
    past: { title: "No past events", hint: "Past events will appear here." },
  }[filter];

  return (
    <>
    <Helmet>
      <title>Tallaght Events – What's On Near You | What's Up Tallaght</title>
      <meta name="description" content="Browse upcoming events in Tallaght, Dublin. Community events, sports, arts, family activities and more — submitted by local residents." />
      <meta property="og:title" content="Tallaght Events – What's On Near You | What's Up Tallaght" />
      <meta property="og:description" content="Browse upcoming events in Tallaght, Dublin. Community events, sports, arts, family activities and more." />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Events</h1>
        <p className="text-muted-foreground">What's happening in Tallaght</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchFilter(key)}
            className={`px-4 py-2 text-sm rounded-full font-medium transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border hover:bg-primary/5 text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "weekend" && weekendRange && (
        <p className="text-sm text-muted-foreground mb-5 -mt-4">
          Showing events for <span className="font-medium text-foreground">{formatShortDate(weekendRange.saturday)}</span> &amp; <span className="font-medium text-foreground">{formatShortDate(weekendRange.sunday)}</span>
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-1">{emptyMessage.title}</p>
          <p className="text-sm text-muted-foreground mb-6">{emptyMessage.hint}</p>
          {filter !== "past" && (
            <a href="https://wa.me/353857141023" target="_blank" rel="noopener noreferrer">
              <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp us your event
              </Button>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const { day, month, weekday } = formatEventDate(event.eventDate);
            const isWhatsApp = event.submissionSource === "whatsapp";
            return (
              <div
                key={event.id}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  event.status === "cancelled"
                    ? "border-red-200 bg-red-50/30"
                    : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center bg-primary/5 border-r border-border px-4 py-4 min-w-[80px]">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">{month}</span>
                    <span className="text-3xl font-bold text-primary leading-tight">{day}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{weekday.slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {event.status === "cancelled" && (
                            <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Cancelled</span>
                          )}
                          {isWhatsApp && (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                              <MessageCircle className="w-2.5 h-2.5" />
                              From local resident
                            </span>
                          )}
                        </div>
                        <h3 className={`font-semibold text-base leading-snug ${event.status === "cancelled" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                          {event.eventTime && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {event.eventTime}{event.endTime ? ` – ${event.endTime}` : ""}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                          {event.price && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="w-3 h-3" />
                              {event.price}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
                        )}
                        {event.organiser && (
                          <p className="text-xs text-muted-foreground mt-1">Organised by <span className="font-medium text-foreground">{event.organiser}</span></p>
                        )}
                      </div>
                      {event.articleHeaderImageUrl && (
                        <img
                          src={`${BASE}${event.articleHeaderImageUrl}`}
                          alt={event.title}
                          className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                      {event.articleSlug && (
                        <Link href={`/article/${event.articleSlug}`}>
                          <span className="text-xs font-medium text-primary hover:underline cursor-pointer">Read full article →</span>
                        </Link>
                      )}
                      {event.websiteUrl && (
                        <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          More info
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 text-sm border border-border rounded-full disabled:opacity-40 hover:bg-primary/5">← Previous</button>
          <span className="px-4 py-2 text-sm text-muted-foreground">{page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 text-sm border border-border rounded-full disabled:opacity-40 hover:bg-primary/5">Next →</button>
        </div>
      )}

      <div className="mt-12 p-6 rounded-2xl bg-secondary/10 border border-secondary/20 text-center">
        <MessageCircle className="w-8 h-8 text-secondary mx-auto mb-2" />
        <h3 className="font-semibold text-foreground mb-1">Got an event to share?</h3>
        <p className="text-sm text-muted-foreground mb-4">WhatsApp us the details and we'll add it to the calendar</p>
        <a href="https://wa.me/353857141023" target="_blank" rel="noopener noreferrer">
          <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp your event
          </Button>
        </a>
      </div>
    </div>
    </>
  );
}
