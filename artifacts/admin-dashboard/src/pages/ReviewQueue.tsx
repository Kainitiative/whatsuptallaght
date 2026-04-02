import { useEffect, useState, useCallback } from "react";
import { getPosts, updatePost, type Post } from "@/lib/api";
import { formatDate, confidenceColour } from "@/lib/utils";

export default function ReviewQueue() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPosts({ status: "held", limit: 50 });
      setPosts(data.posts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(post: Post) {
    setWorking(post.id);
    try {
      await updatePost(post.id, { status: "published" });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } finally {
      setWorking(null);
    }
  }

  async function reject(post: Post) {
    setWorking(post.id);
    try {
      await updatePost(post.id, { status: "rejected" });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Review Queue</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {posts.length === 0 ? "No articles waiting for review" : `${posts.length} article${posts.length !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>
        <button onClick={load} className="text-sm text-primary hover:underline">Refresh</button>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-foreground">Queue is clear</p>
          <p className="text-sm text-muted-foreground mt-1">All articles have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground leading-tight">{post.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</span>
                      {post.confidenceScore && (
                        <span className={`text-xs font-medium ${confidenceColour(post.confidenceScore)}`}>
                          {Math.round(parseFloat(post.confidenceScore) * 100)}% confidence
                        </span>
                      )}
                      {post.wordCount && (
                        <span className="text-xs text-muted-foreground">{post.wordCount} words</span>
                      )}
                    </div>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {expanded === post.id ? "Hide" : "Read"}
                    </button>
                    <button
                      onClick={() => reject(post)}
                      disabled={working === post.id}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve(post)}
                      disabled={working === post.id}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {working === post.id ? "…" : "Publish"}
                    </button>
                  </div>
                </div>
              </div>
              {expanded === post.id && (
                <div className="border-t border-border px-5 py-4 bg-gray-50">
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {post.body}
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
