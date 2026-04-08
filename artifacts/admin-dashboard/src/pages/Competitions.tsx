import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompetitions,
  getCompetition,
  createCompetition,
  closeCompetition,
  drawCompetitionWinner,
  deleteCompetition,
  type Competition,
  type CompetitionDetail,
} from "@/lib/api";
import { format } from "date-fns";
import { Trophy, Plus, Users, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

function statusColour(status: string) {
  if (status === "active") return "bg-green-100 text-green-800";
  if (status === "closed") return "bg-yellow-100 text-yellow-800";
  if (status === "drawn") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

// ---------------------------------------------------------------------------
// Create Competition Form
// ---------------------------------------------------------------------------

function CreateForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    prize: "",
    facebookPostId: "",
    facebookPostUrl: "",
    closingDate: "",
  });

  const createMutation = useMutation({
    mutationFn: createCompetition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      title: form.title,
      prize: form.prize,
      facebookPostId: form.facebookPostId,
      facebookPostUrl: form.facebookPostUrl || undefined,
      closingDate: form.closingDate || undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Competition</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Title</label>
            <input
              type="text"
              required
              placeholder="e.g. April Voucher Giveaway"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Prize</label>
            <input
              type="text"
              required
              placeholder="e.g. €50 voucher for The Square"
              value={form.prize}
              onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Facebook Post ID</label>
            <input
              type="text"
              required
              placeholder="e.g. 977887435417701_123456789"
              value={form.facebookPostId}
              onChange={(e) => setForm((f) => ({ ...f, facebookPostId: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Copy from the post URL on Facebook: facebook.com/.../posts/<strong>THIS_PART</strong>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Post URL <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              value={form.facebookPostUrl}
              onChange={(e) => setForm((f) => ({ ...f, facebookPostUrl: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Closing Date/Time <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="datetime-local"
              value={form.closingDate}
              onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? "Creating…" : "Create Competition"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competition Detail Panel
// ---------------------------------------------------------------------------

function CompetitionDetail({ competitionId, onClose }: { competitionId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => getCompetition(competitionId),
    refetchInterval: 15000,
  });

  const closeMutation = useMutation({
    mutationFn: () => closeCompetition(competitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });

  const drawMutation = useMutation({
    mutationFn: () => drawCompetitionWinner(competitionId),
    onSuccess: () => {
      setConfirmDraw(false);
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCompetition(competitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      onClose();
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">{data.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">🎁 {data.prize}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Winner banner */}
        {data.winner && (
          <div className="mx-6 mt-4 flex-shrink-0 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Winner drawn!</span>
            </div>
            <p className="text-yellow-900 font-medium">{data.winner.facebookUserName}</p>
            {data.winner.commentText && (
              <p className="text-sm text-yellow-800 mt-1 italic">"{data.winner.commentText}"</p>
            )}
            <p className="text-xs text-yellow-700 mt-1">{formatDate(data.winner.enteredAt)}</p>
          </div>
        )}

        {/* Stats + actions */}
        <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between gap-3 flex-wrap border-b border-border">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColour(data.status)}`}>
              {data.status}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {data.entries.length} {data.entries.length === 1 ? "entry" : "entries"}
            </span>
            {data.closingDate && (
              <span className="text-xs text-muted-foreground">Closes {formatDate(data.closingDate)}</span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {data.facebookPostUrl && (
              <a
                href={data.facebookPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Post ↗
              </a>
            )}
            {data.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="text-xs h-8"
              >
                {closeMutation.isPending ? "Closing…" : "Close Entries"}
              </Button>
            )}
            {data.status === "closed" && !data.winnerEntryId && (
              confirmDraw ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => drawMutation.mutate()}
                    disabled={drawMutation.isPending}
                    className="text-xs h-8 bg-yellow-500 hover:bg-yellow-600"
                  >
                    {drawMutation.isPending ? "Drawing…" : "Confirm Draw"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDraw(false)} className="text-xs h-8">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setConfirmDraw(true)}
                  className="text-xs h-8 bg-yellow-500 hover:bg-yellow-600"
                >
                  🎲 Draw Winner
                </Button>
              )
            )}
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs h-8"
                >
                  {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} className="text-xs h-8">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {data.entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No entries yet — comments on the Facebook post will appear here in real-time.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`px-6 py-3 flex items-start gap-3 ${
                    data.winnerEntryId === entry.id ? "bg-yellow-50" : ""
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0 pt-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{entry.facebookUserName}</span>
                      {data.winnerEntryId === entry.id && (
                        <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-full font-semibold">
                          🏆 Winner
                        </span>
                      )}
                    </div>
                    {entry.commentText && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">"{entry.commentText}"</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 pt-0.5">
                    {format(new Date(entry.enteredAt), "d MMM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Competitions() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: competitions, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: getCompetitions,
    refetchInterval: 30000,
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {showCreate && <CreateForm onClose={() => setShowCreate(false)} />}
      {selectedId !== null && (
        <CompetitionDetail competitionId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Competitions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Facebook comment competitions — entries captured in real-time.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          New
        </Button>
      </div>

      {/* Facebook webhook setup notice */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">One-time setup needed</p>
        <p>
          To capture comments automatically, subscribe your Facebook app to page <strong>feed</strong> webhook events.
          Set the callback URL to <code className="bg-blue-100 px-1 rounded text-xs">https://whatsuptallaght.ie/api/webhooks/facebook</code> and
          set a <strong>verify token</strong> in Settings → <em>facebook_webhook_verify_token</em>.
        </p>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
      )}

      {!isLoading && (!competitions || competitions.length === 0) && (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No competitions yet</p>
          <p className="text-sm mt-1">Create one to start tracking entries from Facebook.</p>
        </div>
      )}

      {!isLoading && competitions && competitions.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {competitions.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColour(c.status)}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {c.entryCount} {c.entryCount === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">🎁 {c.prize}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {c.closingDate && (
                      <p className="text-xs text-muted-foreground">
                        Closes {format(new Date(c.closingDate), "d MMM")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(c.createdAt), "d MMM")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
