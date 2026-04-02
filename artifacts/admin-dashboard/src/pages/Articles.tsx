import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { getPosts, updatePost, deletePost, createGoldenExample, type Post } from "@/lib/api";
import { formatDateShort, statusColour, confidenceColour } from "@/lib/utils";
import StarRating from "@/components/StarRating";
import ArticleEditModal from "@/components/ArticleEditModal";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "held", label: "Held" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
];

export default function Articles() {
  const [location] = useLocation();
  const defaultStatus = new URLSearchParams(location.split("?")[1] ?? "").get("status") ?? "";
  const [filter, setFilter] = useState(defaultStatus);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPosts({ status: filter || undefined, page, limit: 20 });
      setPosts(data.posts);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(post: Post, status: string) {
    setWorking(post.id);
    try {
      const updated = await updatePost(post.id, { status: status as any });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      showToast(`Article ${status}`);
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(post: Post) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setWorking(post.id);
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((t) => t - 1);
      showToast("Article deleted");
    } finally {
      setWorking(null);
    }
  }

  async function handleStar(post: Post, rating: number | null) {
    const updated = await updatePost(post.id, { starRating: rating });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    if (rating && rating >= 4) {
      showToast("⭐ Rated! Add as golden example to train the AI.");
    }
  }

  async function handleGolden(post: Post) {
    setWorking(post.id);
    try {
      await createGoldenExample(post.id);
      showToast("✅ Added as golden example — AI will use this for future articles");
    } finally {
      setWorking(null);
    }
  }

  function handleEditSaved(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditPost(null);
    showToast("Article saved");
  }

  return (
    <div className="p-8 max-w-5xl">
      {editPost && (
        <ArticleEditModal
          post={editPost}
          onClose={() => setEditPost(null)}
          onSaved={handleEditSaved}
        />
      )}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Articles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${total} article${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filter === opt.value
                  ? "bg-primary text-white"
                  : "bg-white border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No articles found.</div>
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <div key={post.id}>
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColour(post.status)}`}>
                        {post.status}
                      </span>
                      {post.confidenceScore && (
                        <span className={`text-xs font-medium ${confidenceColour(post.confidenceScore)}`}>
                          {Math.round(parseFloat(post.confidenceScore) * 100)}%
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateShort(post.createdAt)}</span>
                    </div>
                    <h3 className="font-medium text-foreground mt-1 leading-tight">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.excerpt}</p>
                    )}
                    <div className="mt-2">
                      <StarRating
                        value={post.starRating}
                        onChange={(rating) => handleStar(post, rating)}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                      className="px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {expanded === post.id ? "Hide" : "Read"}
                    </button>
                    <button
                      onClick={() => setEditPost(post)}
                      className="px-2.5 py-1.5 text-xs border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    {(post.starRating ?? 0) >= 4 && (
                      <button
                        onClick={() => handleGolden(post)}
                        disabled={working === post.id}
                        className="px-2.5 py-1.5 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                      >
                        ⭐ Add example
                      </button>
                    )}
                    {post.status !== "published" && (
                      <button
                        onClick={() => handleStatusChange(post, "published")}
                        disabled={working === post.id}
                        className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Publish
                      </button>
                    )}
                    {post.status === "published" && (
                      <button
                        onClick={() => handleStatusChange(post, "held")}
                        disabled={working === post.id}
                        className="px-2.5 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={working === post.id}
                      className="px-2.5 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {expanded === post.id && (
                  <div className="border-t border-border px-5 py-4 bg-gray-50">
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {post.body}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
