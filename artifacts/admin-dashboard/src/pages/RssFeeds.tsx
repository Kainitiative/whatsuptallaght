import { useState, useEffect, useCallback } from "react";
import { getRssFeeds, createRssFeed, updateRssFeed, deleteRssFeed, type RssFeed } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background text-sm px-4 py-3 rounded-lg shadow-lg">
      {message}
    </div>
  );
}

const INTERVALS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "6 hours", value: 360 },
  { label: "12 hours", value: 720 },
  { label: "24 hours", value: 1440 },
];

function formatInterval(mins: number) {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${mins / 60}h`;
  return `${mins / 1440}d`;
}

export default function RssFeeds() {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [working, setWorking] = useState<number | "new" | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newInterval, setNewInterval] = useState(60);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editInterval, setEditInterval] = useState(60);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const showToast = (msg: string) => setToast(msg);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRssFeeds();
      setFeeds(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    setWorking("new");
    try {
      await createRssFeed({ name: newName.trim(), url: newUrl.trim(), checkIntervalMinutes: newInterval });
      setNewName(""); setNewUrl(""); setNewInterval(60); setShowAdd(false);
      showToast("Feed added");
      load();
    } catch (err: any) {
      showToast(err.message || "Failed to add feed");
    } finally {
      setWorking(null);
    }
  }

  function startEdit(feed: RssFeed) {
    setEditId(feed.id);
    setEditName(feed.name);
    setEditUrl(feed.url);
    setEditInterval(feed.checkIntervalMinutes);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editName.trim() || !editUrl.trim()) return;
    setWorking(editId);
    try {
      await updateRssFeed(editId, { name: editName.trim(), url: editUrl.trim(), checkIntervalMinutes: editInterval });
      setEditId(null);
      showToast("Feed updated");
      load();
    } catch (err: any) {
      showToast(err.message || "Failed to update feed");
    } finally {
      setWorking(null);
    }
  }

  async function toggleActive(feed: RssFeed) {
    setWorking(feed.id);
    try {
      await updateRssFeed(feed.id, { isActive: !feed.isActive });
      showToast(feed.isActive ? "Feed paused" : "Feed enabled");
      load();
    } catch {
      showToast("Failed to update feed");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(id: number) {
    setWorking(id);
    try {
      await deleteRssFeed(id);
      setConfirmDelete(null);
      showToast("Feed removed");
      load();
    } catch {
      showToast("Failed to delete feed");
    } finally {
      setWorking(null);
    }
  }

  const inputClass = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";
  const selectClass = "border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-8 max-w-5xl">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RSS Feeds</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage the news feeds the AI processes into articles.</p>
        </div>
        <button
          onClick={() => { setShowAdd(s => !s); setEditId(null); }}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add feed"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 bg-muted/40 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">New RSS Feed</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className={inputClass}
              placeholder="Feed name (e.g. Dublin Live)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <input
              className={`${inputClass} md:col-span-1`}
              placeholder="RSS URL"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              type="url"
              required
            />
            <div className="flex gap-2">
              <select className={selectClass} value={newInterval} onChange={e => setNewInterval(Number(e.target.value))}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <button
                type="submit"
                disabled={working === "new"}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {working === "new" ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No RSS feeds configured yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Add a feed above to start ingesting news.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feeds.map(feed => (
            <div key={feed.id} className={`border border-border rounded-xl bg-card transition-all ${!feed.isActive ? "opacity-60" : ""}`}>
              {editId === feed.id ? (
                <form onSubmit={handleEdit} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className={inputClass} value={editName} onChange={e => setEditName(e.target.value)} required />
                    <input className={inputClass} value={editUrl} onChange={e => setEditUrl(e.target.value)} type="url" required />
                    <div className="flex gap-2">
                      <select className={selectClass} value={editInterval} onChange={e => setEditInterval(Number(e.target.value))}>
                        {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                      </select>
                      <button type="submit" disabled={working === feed.id} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                        {working === feed.id ? "…" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditId(null)} className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3">
                  <button
                    onClick={() => toggleActive(feed)}
                    disabled={working === feed.id}
                    title={feed.isActive ? "Click to pause" : "Click to enable"}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${feed.isActive ? "bg-primary" : "bg-muted-foreground/30"} disabled:opacity-50`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${feed.isActive ? "translate-x-4" : "translate-x-0"}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{feed.name}</span>
                      {!feed.isActive && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Paused</span>}
                    </div>
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block max-w-md"
                    >
                      {feed.url}
                    </a>
                  </div>

                  <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    <span>⏱</span>
                    <span>{formatInterval(feed.checkIntervalMinutes)}</span>
                  </div>

                  <div className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                    {feed.lastFetchedAt
                      ? `Fetched ${formatDistanceToNow(new Date(feed.lastFetchedAt), { addSuffix: true })}`
                      : "Never fetched"}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(feed)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(feed.id)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="font-semibold text-foreground mb-2">Remove feed?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This will stop fetching this feed. Existing articles from it will not be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={working === confirmDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {working === confirmDelete ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
