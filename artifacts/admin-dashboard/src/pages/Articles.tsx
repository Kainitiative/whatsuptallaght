import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { getPosts, updatePost, deletePost, createGoldenExample, getPostCost, regeneratePostImage, rematchPostEntity, extractEventFromPost, postArticleToFacebook, getPostSource, type Post, type PostCost } from "@/lib/api";
import { formatDateShort, statusColour, confidenceColour } from "@/lib/utils";
import StarRating from "@/components/StarRating";
import ArticleEditModal from "@/components/ArticleEditModal";

interface PostSource {
  sourceRawText: string | null;
  sourceVoiceTranscript: string | null;
}

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
  const [costs, setCosts] = useState<Record<number, PostCost>>({});
  const [sources, setSources] = useState<Record<number, PostSource>>({});
  const [loadingSource, setLoadingSource] = useState<number | null>(null);
  const [showSource, setShowSource] = useState<Set<number>>(new Set());

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

  async function handleExpand(postId: number) {
    const next = expanded === postId ? null : postId;
    setExpanded(next);
    if (next && !costs[next]) {
      try {
        const cost = await getPostCost(next);
        setCosts((prev) => ({ ...prev, [next]: cost }));
      } catch {}
    }
  }

  async function handleToggleSource(postId: number) {
    const isShowing = showSource.has(postId);
    if (isShowing) {
      setShowSource((prev) => { const next = new Set(prev); next.delete(postId); return next; });
      return;
    }
    setShowSource((prev) => new Set(prev).add(postId));
    if (!sources[postId]) {
      setLoadingSource(postId);
      try {
        const src = await getPostSource(postId);
        setSources((prev) => ({ ...prev, [postId]: src }));
      } catch {
        setSources((prev) => ({ ...prev, [postId]: { sourceRawText: null, sourceVoiceTranscript: null } }));
      } finally {
        setLoadingSource(null);
      }
    }
  }

  async function handleRegenerateImage(post: Post) {
    setWorking(post.id);
    try {
      const updated = await regeneratePostImage(post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      showToast("✅ New image generated");
    } catch (err: any) {
      showToast(`❌ ${err.message ?? "Image generation failed"}`);
    } finally {
      setWorking(null);
    }
  }

  async function handleRematchEntity(post: Post) {
    setWorking(post.id);
    try {
      const result = await rematchPostEntity(post.id);
      if (result.matched && result.post) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? result.post! : p)));
        showToast(`✅ Entity image applied — matched "${result.entityName}"`);
      } else {
        showToast("No matching entity with an image found in this article");
      }
    } catch (err: any) {
      showToast(`❌ ${err.message ?? "Entity rematch failed"}`);
    } finally {
      setWorking(null);
    }
  }

  async function handleExtractEvent(post: Post) {
    setWorking(post.id);
    try {
      const result = await extractEventFromPost(post.id);
      if (result.created) {
        showToast(`✅ Event created for ${result.eventDate}`);
      } else {
        showToast(result.reason ?? "Could not create event");
      }
    } catch (err: any) {
      showToast(`❌ ${err.message ?? "Event extraction failed"}`);
    } finally {
      setWorking(null);
    }
  }

  async function handlePostToFacebook(post: Post) {
    if (!confirm(`Post "${post.title}" to Facebook now?`)) return;
    setWorking(post.id);
    try {
      await postArticleToFacebook(post.id);
      showToast("✅ Posted to Facebook successfully");
    } catch (err: any) {
      showToast(`❌ ${err.message ?? "Facebook post failed"}`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
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

      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Articles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? "Loading…" : `${total} article${total !== 1 ? "s" : ""}`}
        </p>
        {/* Filter pills — horizontally scrollable on mobile */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
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
                <div className="px-4 py-4 md:px-5">
                  {/* Meta row — status badge, score, date */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColour(post.status)}`}>
                      {post.status}
                    </span>
                    {post.confidenceScore && (
                      <span className={`text-xs font-semibold ${confidenceColour(post.confidenceScore)}`}>
                        {Math.round(parseFloat(post.confidenceScore) * 100)}%
                      </span>
                    )}
                    {costs[post.id]?.hasData && (
                      <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        ${parseFloat(costs[post.id].totalCostUsd).toFixed(4)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateShort(post.createdAt)}</span>
                  </div>

                  {/* Title — full width */}
                  <h3 className="font-semibold text-foreground text-base leading-snug mb-1">{post.title}</h3>
                  {post.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{post.excerpt}</p>
                  )}

                  <div className="mb-3">
                    <StarRating
                      value={post.starRating}
                      onChange={(rating) => handleStar(post, rating)}
                      size="sm"
                    />
                  </div>

                  {/* Action buttons — full-width wrapping row */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleExpand(post.id)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {expanded === post.id ? "Hide" : "Read"}
                    </button>
                    <button
                      onClick={() => setEditPost(post)}
                      className="px-3 py-1.5 text-xs border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    {(post.starRating ?? 0) >= 4 && (
                      <button
                        onClick={() => handleGolden(post)}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                      >
                        ⭐ Add example
                      </button>
                    )}
                    {post.status !== "published" && (
                      <button
                        onClick={() => handleStatusChange(post, "published")}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Publish
                      </button>
                    )}
                    {post.status === "published" && (
                      <button
                        onClick={() => handleStatusChange(post, "held")}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={working === post.id}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {expanded === post.id && (
                  <div className="border-t border-border px-5 py-4 bg-gray-50 space-y-4">
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {post.body}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {post.status === "published" && (
                        <button
                          onClick={() => handlePostToFacebook(post)}
                          disabled={working === post.id}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          title="Post this article to the Facebook page as a link post"
                        >
                          📘 Post to Facebook
                        </button>
                      )}
                      <button
                        onClick={() => handleRegenerateImage(post)}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs bg-purple-50 border border-purple-200 text-purple-800 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                      >
                        🎨 Regenerate Image
                      </button>
                      <button
                        onClick={() => handleRematchEntity(post)}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs bg-teal-50 border border-teal-200 text-teal-800 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors"
                        title="Re-scan the article text for a matching entity and apply its logo as the header image"
                      >
                        🏷️ Re-scan Entity Image
                      </button>
                      <button
                        onClick={() => handleExtractEvent(post)}
                        disabled={working === post.id}
                        className="px-3 py-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        title="Re-run AI event extraction and create a calendar event from this article"
                      >
                        📅 Extract Event
                      </button>
                      {post.submissionSource === "whatsapp" && (
                        <button
                          onClick={() => handleToggleSource(post.id)}
                          disabled={loadingSource === post.id}
                          className="px-3 py-1.5 text-xs bg-green-50 border border-green-300 text-green-800 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                          title="Show the original WhatsApp message this article was created from"
                        >
                          {loadingSource === post.id ? "Loading…" : showSource.has(post.id) ? "💬 Hide original" : "💬 Original message"}
                        </button>
                      )}
                    </div>

                    {/* WhatsApp source message */}
                    {post.submissionSource === "whatsapp" && showSource.has(post.id) && (
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Original WhatsApp message</p>
                        {sources[post.id] ? (
                          <>
                            {sources[post.id].sourceRawText ? (
                              <div className="bg-[#dcf8c6] border border-green-200 rounded-xl rounded-tl-sm px-4 py-3 max-w-xl">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{sources[post.id].sourceRawText}</p>
                              </div>
                            ) : null}
                            {sources[post.id].sourceVoiceTranscript ? (
                              <div className={`${sources[post.id].sourceRawText ? "mt-2" : ""} bg-[#dcf8c6] border border-green-200 rounded-xl rounded-tl-sm px-4 py-3 max-w-xl`}>
                                <p className="text-xs text-green-700 mb-1">🎤 Voice note transcript</p>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed italic">{sources[post.id].sourceVoiceTranscript}</p>
                              </div>
                            ) : null}
                            {!sources[post.id].sourceRawText && !sources[post.id].sourceVoiceTranscript && (
                              <p className="text-xs text-muted-foreground italic">No original message recorded for this article.</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        )}
                      </div>
                    )}
                    {costs[post.id] && (
                      <div className="border-t border-border pt-3">
                        {!costs[post.id].hasData ? (
                          <p className="text-xs text-muted-foreground italic">No AI cost data — this article predates cost tracking.</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              AI cost breakdown — total: <span className="text-emerald-700 font-mono">${parseFloat(costs[post.id].totalCostUsd).toFixed(4)}</span>
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left font-medium pb-1">Stage</th>
                                  <th className="text-left font-medium pb-1">Model</th>
                                  <th className="text-right font-medium pb-1">In</th>
                                  <th className="text-right font-medium pb-1">Out</th>
                                  <th className="text-right font-medium pb-1">Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {costs[post.id].stages.map((s, i) => (
                                  <tr key={i} className="text-foreground">
                                    <td className="py-0.5">{s.stage.replace(/_/g, " ")}</td>
                                    <td className="py-0.5 text-muted-foreground">{s.model}</td>
                                    <td className="py-0.5 text-right font-mono">{s.inputTokens.toLocaleString()}</td>
                                    <td className="py-0.5 text-right font-mono">{s.outputTokens.toLocaleString()}</td>
                                    <td className="py-0.5 text-right font-mono text-emerald-700">${parseFloat(s.costUsd).toFixed(4)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
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
