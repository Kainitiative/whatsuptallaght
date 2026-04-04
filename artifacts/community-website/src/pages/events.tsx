import { useState, useEffect } from "react";
import { Link } from "wouter";
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
}

interface EventsResponse {
  events: PublicEvent[];
  total: number;
  totalPages: number;
}

function formatEventDate(dateStr: string): { day: number; month: string; weekday: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IE", { month: "short" }),
    weekday: d.toLocaleDateString("en-IE", { weekday: "long" }),
  };
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function EventsPage() {
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "past">("upcoming");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function load(status: string, p: number) {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/public/events?status=${status}&page=${p}`);
      if (!res.ok) throw new Error();
      const data: EventsResponse = await res.json();
      setEvents(data.events);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(statusFilter, page);
  }, [statusFilter, page]);

  function switchFilter(f: "upcoming" | "past") {
    setStatusFilter(f);
    setPage(1);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">Events</h1>
        <p className="text-muted-foreground">What's happening in Tallaght</p>
      </div>

      <div className="flex gap-2 mb-8">
        <button
          onClick={() => switchFilter("upcoming")}
          className={`px-4 py-2 text-sm rounded-full font-medium transition-colors ${
            statusFilter === "upcoming"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-primary/5 text-muted-foreground"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => switchFilter("past")}
          className={`px-4 py-2 text-sm rounded-full font-medium transition-colors ${
            statusFilter === "past"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-primary/5 text-muted-foreground"
          }`}
        >
          Past Events
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-1">
            {statusFilter === "upcoming" ? "No upcoming events" : "No past events"}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {statusFilter === "upcoming"
              ? "Know about an event in Tallaght? Let us know!"
              : "Past events will appear here."}
          </p>
          {statusFilter === "upcoming" && (
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
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {event.status === "cancelled" && (
                          <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium mb-1">Cancelled</span>
                        )}
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
  );
}
