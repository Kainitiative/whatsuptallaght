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
        <h1 className="text-2xl font-bold text-foreground">Pillar Pages</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate a community news article for any pillar page. Articles are saved as{" "}
          <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">drafts</span>{" "}
          — review and publish from the Review Queue.
        </p>
      </div>

      {loading && (
        <div className="text-muted-foreground text-sm">Loading pillar pages…</div>
      )}

      {!loading && pillars && pillars.length === 0 && (
        <div className="text-muted-foreground text-sm">No pillar pages configured.</div>
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
                      className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      ✨ Generate Article
                    </button>
                  ) : state.status === "generating" ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 bg-purple-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm cursor-not-allowed"
                    >
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Writing article…
                    </button>
                  ) : state.status === "done" ? (
                    <button
                      onClick={() => generate(pillar)}
                      className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      ↻ Regenerate
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Key points */}
              <div className="px-6 py-4 bg-slate-50 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Key points the article will cover
                </p>
                <ul className="grid sm:grid-cols-2 gap-1">
                  {pillar.keyPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="text-purple-400 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Result area */}
              {state.status === "generating" && (
                <div className="px-6 py-6 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full" />
                  AI is writing the article — this takes about 15 seconds…
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
                          ✅ Draft saved
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

      {/* How it works */}
      <div className="mt-10 bg-slate-50 border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-3">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">1.</span> Click "Generate Article" — the AI writes a ~450-word community news article based on the pillar page content.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">2.</span> The article is saved as a <span className="font-medium text-amber-700">draft</span> and appears in the Review Queue for you to check before publishing.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">3.</span> Publishing the draft automatically posts it to Facebook and generates social captions.</li>
          <li className="flex items-start gap-2"><span className="font-bold text-foreground shrink-0">4.</span> You can regenerate as many times as you like — each run creates a new draft.</li>
        </ol>
      </div>
    </div>
  );
}
