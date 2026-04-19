import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type ContactSubmission = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  unread: { label: "Unread", cls: "bg-red-100 text-red-700 border-red-200" },
  read: { label: "Read", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  replied: { label: "Replied", cls: "bg-green-100 text-green-700 border-green-200" },
};

export default function ContactMessages() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["contact-submissions"],
    queryFn: () => apiFetch("/contact").then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      apiFetch(`/contact/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-submissions"] }),
  });

  const submissions: ContactSubmission[] = data?.submissions ?? [];

  function toggleExpand(id: number, submission: ContactSubmission) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setNotes((prev) => ({ ...prev, [id]: submission.notes ?? "" }));
    if (submission.status === "unread") {
      updateMutation.mutate({ id, payload: { status: "read" } });
    }
  }

  async function saveNotes(id: number) {
    setSavingNotes(id);
    await updateMutation.mutateAsync({ id, payload: { notes: notes[id] ?? "" } });
    setSavingNotes(null);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
        {data?.unreadCount > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-semibold text-red-600">{data.unreadCount} unread</span>
          </p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          Failed to load contact submissions.
        </div>
      )}

      {!isLoading && submissions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📬</p>
          <p className="font-medium">No messages yet</p>
          <p className="text-sm mt-1">Contact form submissions will appear here.</p>
        </div>
      )}

      {!isLoading && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((s) => {
            const isOpen = expanded === s.id;
            const badgeInfo = STATUS_LABELS[s.status] ?? STATUS_LABELS.read;
            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-card transition-shadow ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}
              >
                <button
                  onClick={() => toggleExpand(s.id, s)}
                  className="w-full text-left px-5 py-4 flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeInfo.cls}`}>
                        {badgeInfo.label}
                      </span>
                      {s.subject && (
                        <span className="text-xs text-muted-foreground">{s.subject}</span>
                      )}
                    </div>
                    <p className={`font-semibold text-foreground truncate ${s.status === "unread" ? "font-bold" : ""}`}>
                      {s.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{s.email}</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground mt-1">
                    {new Date(s.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                    <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {s.message}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(["unread", "read", "replied"] as const).map((status) => (
                        <button
                          key={status}
                          disabled={s.status === status || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: s.id, payload: { status } })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                            s.status === status
                              ? `${STATUS_LABELS[status].cls} cursor-default`
                              : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          Mark as {STATUS_LABELS[status].label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Private notes
                      </label>
                      <textarea
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-y"
                        placeholder="Add internal notes…"
                        value={notes[s.id] ?? s.notes ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => saveNotes(s.id)}
                        disabled={savingNotes === s.id}
                        className="mt-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {savingNotes === s.id ? "Saving…" : "Save notes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
