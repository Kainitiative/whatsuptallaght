import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  getEntityPages,
  deleteEntityPage,
  publishEntityPage,
  type EntityPageSummary,
  type EntityPageType,
} from "@/lib/api";

const TYPE_LABELS: Record<EntityPageType, string> = {
  sports_club: "Sports Club",
  venue: "Venue",
  place: "Place",
  business: "Business",
  organisation: "Organisation",
  event_series: "Event Series",
};

const TYPE_COLORS: Record<EntityPageType, string> = {
  sports_club: "bg-green-100 text-green-700",
  venue: "bg-amber-100 text-amber-700",
  place: "bg-sky-100 text-sky-700",
  business: "bg-violet-100 text-violet-700",
  organisation: "bg-blue-100 text-blue-700",
  event_series: "bg-rose-100 text-rose-700",
};

export default function EntityPages() {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EntityPageSummary | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["entity-pages"],
    queryFn: getEntityPages,
  });

  const deleteMut = useMutation({
    mutationFn: deleteEntityPage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entity-pages"] });
      setConfirmDelete(null);
    },
    onSettled: () => setDeletingId(null),
  });

  const publishMut = useMutation({
    mutationFn: publishEntityPage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-pages"] }),
  });

  function handleDelete(page: EntityPageSummary) {
    setConfirmDelete(page);
  }

  function confirmDoDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    deleteMut.mutate(confirmDelete.id);
  }

  const published = pages.filter((p) => p.status === "published").length;
  const draft = pages.filter((p) => p.status === "draft").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entity Pages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SEO landing pages for clubs, venues, businesses &amp; places in Tallaght
          </p>
        </div>
        <Link href="/entity-pages/new">
          <a className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            + New Entity Page
          </a>
        </Link>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <div className="px-4 py-2 bg-card border border-border rounded-lg text-sm">
          <span className="font-semibold text-foreground">{pages.length}</span>
          <span className="text-muted-foreground ml-1">total</span>
        </div>
        <div className="px-4 py-2 bg-card border border-border rounded-lg text-sm">
          <span className="font-semibold text-green-600">{published}</span>
          <span className="text-muted-foreground ml-1">published</span>
        </div>
        <div className="px-4 py-2 bg-card border border-border rounded-lg text-sm">
          <span className="font-semibold text-amber-600">{draft}</span>
          <span className="text-muted-foreground ml-1">draft</span>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No entity pages yet.</p>
          <Link href="/entity-pages/new">
            <a className="mt-3 inline-block text-sm text-primary hover:underline">
              Create your first entity page →
            </a>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Articles</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/entity-pages/${page.id}`}>
                      <a className="font-medium text-foreground hover:text-primary transition-colors">
                        {page.name}
                      </a>
                    </Link>
                    {page.shortDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {page.shortDescription}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                      /place/{page.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        TYPE_COLORS[page.entityType]
                      }`}
                    >
                      {TYPE_LABELS[page.entityType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => publishMut.mutate(page.id)}
                      disabled={publishMut.isPending}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        page.status === "published"
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          page.status === "published" ? "bg-green-500" : "bg-amber-500"
                        }`}
                      />
                      {page.status === "published" ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-muted-foreground">{page.articleCount}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(page.updatedAt).toLocaleDateString("en-IE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/entity-pages/${page.id}`}>
                        <a className="text-xs px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors">
                          Edit
                        </a>
                      </Link>
                      <button
                        onClick={() => handleDelete(page)}
                        className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete entity page?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong>{confirmDelete.name}</strong> and cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDoDelete}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
