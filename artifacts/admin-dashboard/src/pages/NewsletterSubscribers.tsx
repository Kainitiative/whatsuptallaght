import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Subscriber = {
  id: number;
  email: string;
  name: string | null;
  source: string;
  status: string;
  subscribedAt: string;
};

const SOURCE_LABELS: Record<string, string> = {
  contact_form: "Contact form",
  footer_widget: "Footer widget",
};

export default function NewsletterSubscribers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: () => apiFetch("/newsletter/subscribers").then((r) => r.json()),
  });

  const subscribers: Subscriber[] = data?.subscribers ?? [];

  function exportCsv() {
    const header = "Name,Email,Source,Status,Subscribed At";
    const rows = subscribers.map((s) =>
      [
        `"${(s.name ?? "").replace(/"/g, '""')}"`,
        `"${s.email}"`,
        `"${SOURCE_LABELS[s.source] ?? s.source}"`,
        `"${s.status}"`,
        `"${new Date(s.subscribedAt).toISOString()}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Newsletter Subscribers</h1>
          {data?.totalActive !== undefined && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{data.totalActive}</span> active subscriber{data.totalActive !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {subscribers.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex-shrink-0 px-4 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          Failed to load subscribers.
        </div>
      )}

      {!isLoading && subscribers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📧</p>
          <p className="font-medium">No subscribers yet</p>
          <p className="text-sm mt-1">Subscribers from the website will appear here.</p>
        </div>
      )}

      {!isLoading && subscribers.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Subscribed</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-foreground">{s.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(s.subscribedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      s.status === "active"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
