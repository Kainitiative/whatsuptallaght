import { useState } from "react";
import { updatePost, createGoldenExample, type Post } from "@/lib/api";

interface Props {
  post: Post;
  onClose: () => void;
  onSaved: (post: Post) => void;
}

export default function ArticleEditModal({ post, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body ?? "");
  const [imagePrompt, setImagePrompt] = useState(post.imagePrompt ?? "");
  const [asExample, setAsExample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(publishAfter: boolean) {
    setSaving(true);
    setError(null);
    try {
      const excerpt = body.split(". ").slice(0, 2).join(". ") + ".";
      const status = publishAfter ? "published" : post.status;
      const updated = await updatePost(post.id, { title, body, excerpt, status, imagePrompt: imagePrompt || undefined });
      if (asExample) {
        await createGoldenExample(post.id, "Manually corrected by editor");
      }
      onSaved(updated);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">Edit Article</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Headline
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Article body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Image prompt
              <span className="ml-2 normal-case text-muted-foreground/70 font-normal">Used by AI to generate the header image on publish</span>
            </label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              placeholder="Describe the image you want — e.g. 'Wide cinematic photo of Tallaght town centre at dusk, community gathering'"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <input
              type="checkbox"
              id="as-example"
              checked={asExample}
              onChange={(e) => setAsExample(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <label htmlFor="as-example" className="text-sm text-amber-900 cursor-pointer leading-snug">
              <span className="font-semibold">Use as training example</span>
              <span className="block text-xs text-amber-700 mt-0.5">
                The AI will use this corrected version to improve future articles in the same category.
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => save(false)}
              disabled={saving || !title.trim() || !body.trim()}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || !title.trim() || !body.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? "Saving…" : "Save & Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
