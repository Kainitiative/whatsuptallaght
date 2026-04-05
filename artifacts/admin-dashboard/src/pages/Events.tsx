import { useEffect, useState } from "react";
import { getEvents, updateEvent, deleteEvent, type AdminEvent } from "@/lib/api";

const STATUS_COLOURS: Record<string, string> = {
  upcoming: "bg-green-50 text-green-700 border-green-200",
  past: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

interface EditState {
  title: string;
  eventDate: string;
  eventTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
  organiser: string;
  contactInfo: string;
  websiteUrl: string;
  price: string;
  status: string;
}

export default function Events() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getEvents({ status: statusFilter || undefined, page });
      setEvents(data.events);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      showToast("Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter, page]);

  function startEdit(event: AdminEvent) {
    setEditing(event);
    setEditState({
      title: event.title,
      eventDate: event.eventDate ?? "",
      eventTime: event.eventTime ?? "",
      endDate: event.endDate ?? "",
      endTime: event.endTime ?? "",
      location: event.location ?? "",
      description: event.description ?? "",
      organiser: event.organiser ?? "",
      contactInfo: event.contactInfo ?? "",
      websiteUrl: event.websiteUrl ?? "",
      price: event.price ?? "",
      status: event.status,
    });
  }

  async function handleSave() {
    if (!editing || !editState) return;
    setSaving(true);
    try {
      const updated = await updateEvent(editing.id, editState);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      setEditing(null);
      showToast("Event saved");
    } catch {
      showToast("Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => t - 1);
      showToast("Event deleted");
    } catch {
      showToast("Failed to delete event");
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      {editing && editState && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-lg">Edit Event</h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { label: "Title", key: "title", type: "text" },
                { label: "Event Date", key: "eventDate", type: "date" },
                { label: "Start Time", key: "eventTime", type: "text", placeholder: "e.g. 10:00 AM" },
                { label: "End Date", key: "endDate", type: "date" },
                { label: "End Time", key: "endTime", type: "text", placeholder: "e.g. 4:00 PM" },
                { label: "Location / Venue", key: "location", type: "text" },
                { label: "Organiser", key: "organiser", type: "text" },
                { label: "Price", key: "price", type: "text", placeholder: "Free / €5 / Donation welcome" },
                { label: "Contact Info", key: "contactInfo", type: "text" },
                { label: "Website URL", key: "websiteUrl", type: "text" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editState as any)[key]}
                    placeholder={placeholder}
                    onChange={(e) => setEditState((s) => s ? { ...s, [key]: e.target.value } : s)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editState.description}
                  onChange={(e) => setEditState((s) => s ? { ...s, description: e.target.value } : s)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                <select
                  value={editState.status}
                  onChange={(e) => setEditState((s) => s ? { ...s, status: e.target.value } : s)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Saving…" : "Save Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} event{total !== 1 ? "s" : ""} total</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">No events yet</p>
          <p className="text-sm mt-1">Events are created automatically when WhatsApp submissions or RSS articles are identified as events.</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {events.map((event) => (
            <div key={event.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-center bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 min-w-[64px]">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-IE", { month: "short" })}
                  </p>
                  <p className="text-2xl font-bold text-primary leading-tight">
                    {new Date(event.eventDate + "T12:00:00").getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOURS[event.status] ?? ""}`}>
                      {event.status}
                    </span>
                    {event.articleDeleted && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">source article removed</span>
                    )}
                    {event.articleId && !event.articleDeleted && event.articleSlug && (
                      <a
                        href={`/article/${event.articleSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View article →
                      </a>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{event.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {event.eventTime && <span>🕐 {event.eventTime}{event.endTime ? ` – ${event.endTime}` : ""}</span>}
                    {event.location && <span>📍 {event.location}</span>}
                    {event.price && <span>🎟 {event.price}</span>}
                    {event.organiser && <span>👤 {event.organiser}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => startEdit(event)}
                    className="px-2.5 py-1.5 text-xs border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="px-2.5 py-1.5 text-xs border border-red-200 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}
