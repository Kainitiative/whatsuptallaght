import { useEffect, useState, useCallback } from "react";
import {
  getAdminBusinesses,
  updateBusiness,
  approveBusiness,
  rejectBusiness,
  toggleBusinessFeature,
  type AdminBusiness,
} from "@/lib/api";

const STATUS_TABS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLOURS: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-800",
};

interface EditState {
  id: number;
  name: string;
  ownerName: string;
  category: string;
  subcategory: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  area: string;
  facebookPostText: string;
}

export default function BusinessDirectory() {
  const [tab, setTab] = useState<string>("pending_review");
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminBusinesses(tab);
      setBusinesses(data);
    } catch {
      showToast("Failed to load businesses", false);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function startEdit(b: AdminBusiness) {
    setEditing({
      id: b.id,
      name: b.name,
      ownerName: b.ownerName ?? "",
      category: b.category,
      subcategory: b.subcategory ?? "",
      description: b.description ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      website: b.website ?? "",
      address: b.address ?? "",
      area: b.area ?? "",
      facebookPostText: b.facebookPostText ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await updateBusiness(editing.id, {
        name: editing.name,
        ownerName: editing.ownerName || null,
        category: editing.category,
        subcategory: editing.subcategory || null,
        description: editing.description || null,
        phone: editing.phone || null,
        email: editing.email || null,
        website: editing.website || null,
        address: editing.address || null,
        area: editing.area || null,
        facebookPostText: editing.facebookPostText || null,
      });
      setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setEditing(null);
      showToast("Saved");
    } catch {
      showToast("Save failed", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(b: AdminBusiness) {
    setWorking(b.id);
    try {
      await approveBusiness(b.id);
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
      showToast(`"${b.name}" approved and posted to Facebook!`);
    } catch {
      showToast("Approve failed", false);
    } finally {
      setWorking(null);
    }
  }

  async function handleReject(b: AdminBusiness) {
    if (!confirm(`Reject "${b.name}"? The submitter will be notified.`)) return;
    setWorking(b.id);
    try {
      await rejectBusiness(b.id);
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
      showToast(`"${b.name}" rejected`);
    } catch {
      showToast("Reject failed", false);
    } finally {
      setWorking(null);
    }
  }

  async function handleToggleFeature(b: AdminBusiness) {
    setWorking(b.id);
    try {
      const result = await toggleBusinessFeature(b.id);
      setBusinesses((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, isFeatured: result.isFeatured } : x)),
      );
      showToast(result.isFeatured ? "Marked as featured" : "Removed from featured");
    } catch {
      showToast("Failed", false);
    } finally {
      setWorking(null);
    }
  }

  const pendingCount = businesses.length;

  return (
    <div className="p-8 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Edit Business Listing</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label: "Business Name", key: "name" as const },
                { label: "Owner Name", key: "ownerName" as const },
                { label: "Category", key: "category" as const },
                { label: "Subcategory", key: "subcategory" as const },
                { label: "Area (e.g. Tallaght Village)", key: "area" as const },
                { label: "Phone", key: "phone" as const },
                { label: "Email", key: "email" as const },
                { label: "Website", key: "website" as const },
                { label: "Address", key: "address" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={editing[key]}
                    onChange={(e) => setEditing((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Directory Description</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={editing.description}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Facebook Post Text</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={editing.facebookPostText}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, facebookPostText: e.target.value } : prev)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {editing.facebookPostText.length}/220 chars · Directory link added automatically
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-5 py-2 bg-primary text-white text-sm rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "pending_review"
              ? pendingCount === 0
                ? "No businesses waiting for review"
                : `${pendingCount} listing${pendingCount !== 1 ? "s" : ""} waiting for review`
              : `${pendingCount} listing${pendingCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={load} className="text-sm text-primary hover:underline">Refresh</button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : businesses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🏪</p>
          <p className="font-medium">No {STATUS_TABS.find((t) => t.value === tab)?.label.toLowerCase()} listings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {businesses.map((b) => {
            const isOpen = expanded === b.id;
            const isWorking = working === b.id;
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 flex items-start gap-4">
                  {/* Logo */}
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt={b.name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">
                      🏪
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{b.name}</span>
                      {b.ownerName && (
                        <span className="text-xs text-gray-500">({b.ownerName})</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[b.status] ?? ""}`}>
                        {b.status.replace("_", " ")}
                      </span>
                      {b.isFeatured && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">
                          ⭐ Featured
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{b.category}{b.subcategory ? ` · ${b.subcategory}` : ""}</span>
                      {b.area && <span className="text-xs text-gray-400">📍 {b.area}</span>}
                      {b.phone && <span className="text-xs text-gray-400">📞 {b.phone}</span>}
                      {b.website && (
                        <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          🌐 Website
                        </a>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{b.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted {new Date(b.createdAt).toLocaleDateString("en-IE")}
                      {b.expiresAt ? ` · Expires ${new Date(b.expiresAt).toLocaleDateString("en-IE")}` : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {b.status === "pending_review" && (
                      <>
                        <button
                          onClick={() => handleApprove(b)}
                          disabled={isWorking}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {isWorking ? "…" : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => startEdit(b)}
                          className="px-3 py-1.5 border border-gray-200 text-xs text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleReject(b)}
                          disabled={isWorking}
                          className="px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {b.status === "active" && (
                      <>
                        <button
                          onClick={() => handleToggleFeature(b)}
                          disabled={isWorking}
                          className="px-3 py-1.5 border border-yellow-300 text-yellow-700 text-xs rounded-lg hover:bg-yellow-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          {b.isFeatured ? "Unfeature" : "⭐ Feature"}
                        </button>
                        <button
                          onClick={() => startEdit(b)}
                          className="px-3 py-1.5 border border-gray-200 text-xs text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleReject(b)}
                          disabled={isWorking}
                          className="px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                    {(b.status === "rejected" || b.status === "inactive") && (
                      <button
                        onClick={() => startEdit(b)}
                        className="px-3 py-1.5 border border-gray-200 text-xs text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : b.id)}
                      className="px-3 py-1.5 border border-gray-100 text-xs text-gray-400 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                    >
                      {isOpen ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                    {b.facebookPostText && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Facebook Post Preview</p>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-sm text-blue-900 whitespace-pre-wrap">
                          {b.facebookPostText}
                          <span className="text-blue-400"> [link auto-added]</span>
                        </div>
                      </div>
                    )}
                    {b.email && (
                      <div className="text-xs text-gray-600"><span className="font-medium">Email:</span> {b.email}</div>
                    )}
                    {b.address && (
                      <div className="text-xs text-gray-600"><span className="font-medium">Address:</span> {b.address}</div>
                    )}
                    {b.facebookPostId && (
                      <div className="text-xs text-gray-400">
                        Facebook post ID: {b.facebookPostId}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Submission #{b.sourceSubmissionId} · Listing ID {b.id} · Slug: {b.slug}
                    </div>
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
