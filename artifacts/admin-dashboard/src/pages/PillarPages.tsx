import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface PillarPage {
  id: string;
  title: string;
  description: string;
  pageUrl: string;
  keyPoints: string[];
}

interface GenerateResult {
  post: {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    wordCount: number | null;
  };
  articleUrl: string;
}

type PageState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "done"; result: GenerateResult }
  | { status: "error"; message: string };

export default function PillarPages() {
  const [pillars, setPillars] = useState<PillarPage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageStates, setPageStates] = useState<Record<string, PageState>>({});

  async function loadPillars() {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/pillar-articles");
      const data = await res.json();
      setPillars(data);
    } catch {
      setPillars([]);
    } finally {
      setLoading(false);
    }
  }

  if (!pillars && !loading) {
    loadPillars();
  }

  function setState(id: string, state: PageState) {
    setPageStates((prev) => ({ ...prev, [id]: state }));
  }

  async function generate(pillar: PillarPage) {
    setState(pillar.id, { status: "generating" });
    try {
      const res = await apiFetch(`/admin/pillar-articles/${pillar.id}/generate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const result: GenerateResult = await res.json();
      setState(pillar.id, { status: "done", result });
    } catch (err: any) {
      setState(pillar.id, { status: "error", message: err.message ?? "Unknown error" });
    }
  }

  const siteBase = "https://whatsuptallaght.ie";

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🗞️</span>
          <h1 className="text-2xl font-bold text-foreground">Kent Engine</h1>
          <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full tracking-wide uppercase">Pillar Desk</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Assign a story brief to Kent — he'll research it, write a draft, and leave it on your desk.{" "}
          <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Nothing goes to print until you say so.</span>
        </p>
      </div>

      {loading && (
        <div className="text-muted-foreground text-sm">Loading the Pillar Desk…</div>
      )}

      {!loading && pillars && pillars.length === 0 && (
        <div className="text-muted-foreground text-sm">No stories assigned to the Pillar Desk.</div>
      )}

      <div className="space-y-5">
        {(pillars ?? []).map((pillar) => {
          const state = pageStates[pillar.id] ?? { status: "idle" };

          return (
            <div
              key={pillar.id}
              className="bg-white border border-border rounded-xl overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📄</span>
                    <h2 className="font-semibold text-foreground text-lg">{pillar.title}</h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">{pillar.description}</p>
                  <a
                    href={`${siteBase}${pillar.pageUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline font-mono"
                  >
                    {siteBase}{pillar.pageUrl}
                  </a>
                </div>

                <div className="shrink-0">
                  {state.status === "idle" || state.status === "error" ? (
                    <button
                      onClick={() => generate(pillar)}
                      className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      ✏️ Assign to Kent
                    </button>
                  ) : state.status === "generating" ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 bg-slate-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm cursor-not-allowed"
                    >
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Kent is on it…
                    </button>
                  ) : state.status === "done" ? (
                    <button
                      onClick={() => generate(pillar)}
                      className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      ↻ Reassign to Kent
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Story brief */}
              <div className="px-6 py-4 bg-slate-50 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Story brief Kent will follow
                </p>
                <ul className="grid sm:grid-cols-2 gap-1">
                  {pillar.keyPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="text-slate-400 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Result area */}
              {state.status === "generating" && (
                <div className="px-6 py-6 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full" />
                  Kent is at his desk — researching and writing this one. About 15 seconds…
                </div>
              )}

              {state.status === "error" && (
                <div className="px-6 py-4 bg-red-50 border-t border-red-200">
                  <p className="text-sm text-red-700">
                    <span className="font-semibold">Error:</span> {state.message}
                  </p>
                </div>
              )}

              {state.status === "done" && (
                <div className="px-6 py-5">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                          📋 Kent filed a draft
                        </span>
                        <h3 className="font-semibold text-foreground mt-1 text-base">
                          {state.result.post.title}
                        </h3>
                        {state.result.post.excerpt && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {state.result.post.excerpt}
                          </p>
                        )}
                        {state.result.post.wordCount && (
                          <p className="text-xs text-green-700 mt-1">
                            {state.result.post.wordCount} words · ID #{state.result.post.id}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`/review`}
                        className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        🔶 Review & Publish
                      </a>
                      <a
                        href={`${siteBase}/article/${state.result.post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        👁 Preview draft
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How the newsroom works */}
      <div className="mt-10 bg-slate-50 border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-1">How the Pillar Desk works</h3>
        <p className="text-xs text-muted-foreground mb-4">Kent works quietly in the background. You make every editorial call.</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">1.</span> Click "Assign to Kent" — he reads the story brief and writes a ~450-word community article in WUT's voice.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">2.</span> Kent files it as a <span className="font-medium text-amber-700">draft</span> — it lands in the Review Queue for you to read before anything goes live.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">3.</span> When you publish, it automatically posts to Facebook and generates social captions.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">4.</span> Not happy with the draft? Reassign to Kent — each run creates a fresh version.</li>
        </ol>
      </div>
    </div>
  );
}
