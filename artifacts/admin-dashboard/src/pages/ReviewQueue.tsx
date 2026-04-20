import { useEffect, useState, useCallback } from "react";
import { getPosts, updatePost, getPostSource, type Post } from "@/lib/api";
import { formatDate, confidenceColour } from "@/lib/utils";
import ArticleEditModal from "@/components/ArticleEditModal";

interface PostSource {
  sourceRawText: string | null;
  sourceVoiceTranscript: string | null;
}

export default function ReviewQueue() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [sources, setSources] = useState<Record<number, PostSource>>({});
  const [loadingSource, setLoadingSource] = useState<number | null>(null);

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

  async function handleExpand(postId: number) {
    if (expanded === postId) {
      setExpanded(null);
      return;
    }
    setExpanded(postId);
    if (!sources[postId]) {
      setLoadingSource(postId);
      try {
        const source = await getPostSource(postId);
        setSources((prev) => ({ ...prev, [postId]: source }));
      } catch {
      } finally {
        setLoadingSource(null);
      }
    }
  }

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

  function handleEditSaved(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p))
      .filter((p) => updated.status === "held" ? true : p.id !== updated.id));
    setEditPost(null);
  }

  return (
    <div className="p-8 max-w-4xl">
      {editPost && (
        <ArticleEditModal
          post={editPost}
          onClose={() => setEditPost(null)}
          onSaved={handleEditSaved}
        />
      )}
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
          {posts.map((post) => {
            const source = sources[post.id];
            const isExpanded = expanded === post.id;
            return (
              <div key={post.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="p-5">
                  {post.tone === "personal_story" && (
                    <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2.5 mb-3">
                      <span className="text-base leading-none mt-0.5">💜</span>
                      <div>
                        <p className="text-xs font-semibold text-purple-800">Personal Story — Handle with Care</p>
                        <p className="text-xs text-purple-700 mt-0.5">This is a first-person lived experience. Read in full before making any decision. Never auto-publish. Preserve the contributor's voice and dignity.</p>
                      </div>
                    </div>
                  )}
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
                        {post.tone && (
                          <span className="text-xs text-muted-foreground capitalize">{post.tone.replace("_", " ")}</span>
                        )}
                      </div>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleExpand(post.id)}
                        className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isExpanded ? "Hide" : "Read"}
                      </button>
                      <button
                        onClick={() => setEditPost(post)}
                        className="px-3 py-1.5 text-xs border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Edit
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
                {isExpanded && (
                  <div className="border-t border-border bg-gray-50">
                    {/* Header image */}
                    {post.headerImageUrl ? (
                      <div className="w-full aspect-[16/7] overflow-hidden bg-gray-100">
                        <img
                          src={post.headerImageUrl}
                          alt="Header"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : post.imagePrompt ? (
                      <div className="px-5 pt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                          <span className="font-medium">No image yet</span> — AI will generate one on publish.
                          <span className="block mt-0.5 text-amber-700 italic">"{post.imagePrompt}"</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Original WhatsApp message — lazy loaded */}
                    {loadingSource === post.id ? (
                      <div className="px-5 pt-4">
                        <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
                          <p className="text-xs text-gray-400">Loading original message…</p>
                        </div>
                      </div>
                    ) : source && (source.sourceRawText || source.sourceVoiceTranscript) ? (
                      <div className="px-5 pt-4">
                        <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Original message</p>
                          {source.sourceRawText && (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{source.sourceRawText}</p>
                          )}
                          {source.sourceVoiceTranscript && (
                            <div className={source.sourceRawText ? "mt-2 pt-2 border-t border-gray-300" : ""}>
                              <p className="text-xs text-gray-400 mb-1">Voice note transcript</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">{source.sourceVoiceTranscript}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Article body */}
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        {post.tone === "personal_story" ? "Community Voices draft" : "AI-generated article"}
                      </p>
                      <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                        {post.body}
                      </div>
                    </div>

                    {/* Submitted WhatsApp photos */}
                    {post.bodyImages && post.bodyImages.length > 0 && (
                      <div className="px-5 pb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Submitted photos</p>
                        <div className="flex flex-wrap gap-2">
                          {post.bodyImages.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt={`Submitted photo ${i + 1}`}
                              className="h-28 w-auto rounded-lg object-cover border border-border"
                            />
                          ))}
                        </div>
                      </div>
                    )}
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
