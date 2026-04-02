import { useEffect, useState, useCallback } from "react";
import { getGoldenExamples, deleteGoldenExample, type GoldenExample } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function GoldenExamples() {
  const [examples, setExamples] = useState<GoldenExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [working, setWorking] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGoldenExamples();
      setExamples(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("Remove this golden example? The AI will stop using it for future articles.")) return;
    setWorking(id);
    try {
      await deleteGoldenExample(id);
      setExamples((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Golden Examples</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The AI uses these articles as style references when writing new content.
          Add examples from the Articles page by giving an article 4 or 5 stars, then clicking "Add example".
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 flex gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div className="text-sm text-blue-900">
          <strong>How it works:</strong> When the AI writes a new article, it reads up to 3 examples from the matching category and uses them as a style guide.
          The more examples you add, the more consistent and on-brand the writing becomes.
          Aim for 3–5 examples per category for best results.
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : examples.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">⭐</p>
          <p className="font-semibold text-foreground">No golden examples yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Go to <strong>Articles</strong>, find a well-written AI article, rate it 4 or 5 stars, and click "Add example".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map((ex) => (
            <div key={ex.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {ex.categoryName && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {ex.categoryName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDateShort(ex.createdAt)}</span>
                  </div>
                  {ex.notes && (
                    <p className="text-sm text-foreground font-medium mt-1">{ex.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ex.outputText.slice(0, 150)}…</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {expanded === ex.id ? "Hide" : "View"}
                  </button>
                  <button
                    onClick={() => handleDelete(ex.id)}
                    disabled={working === ex.id}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {expanded === ex.id && (
                <div className="border-t border-border px-5 py-4 bg-gray-50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Article text used as example</p>
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {ex.outputText}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
