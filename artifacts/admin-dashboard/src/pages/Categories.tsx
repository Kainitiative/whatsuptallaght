import { useState, useEffect, useCallback } from "react";
import { getCategories, createCategory, updateCategory, deleteCategory, type Category } from "@/lib/api";

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background text-sm px-4 py-3 rounded-lg shadow-lg">
      {message}
    </div>
  );
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [working, setWorking] = useState<number | "new" | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newColor, setNewColor] = useState("#C0392B");
  const [newDesc, setNewDesc] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editColor, setEditColor] = useState("#C0392B");
  const [editDesc, setEditDesc] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const showToast = (msg: string) => setToast(msg);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories([...data].sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleNewNameChange(val: string) {
    setNewName(val);
    setNewSlug(slugify(val));
  }

  async function handleAdd() {
    if (!newName.trim() || !newSlug.trim()) return;
    setWorking("new");
    try {
      await createCategory({ name: newName.trim(), slug: newSlug.trim(), color: newColor, description: newDesc.trim() || null });
      setNewName(""); setNewSlug(""); setNewColor("#C0392B"); setNewDesc(""); setShowAdd(false);
      await load();
      showToast("Category created");
    } catch (err: any) {
      showToast(err.message ?? "Failed to create category");
    } finally {
      setWorking(null);
    }
  }

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditColor(cat.color);
    setEditDesc(cat.description ?? "");
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function handleSave(id: number) {
    setWorking(id);
    try {
      await updateCategory(id, { name: editName.trim(), slug: editSlug.trim(), color: editColor, description: editDesc.trim() || null });
      setEditId(null);
      await load();
      showToast("Category updated");
    } catch (err: any) {
      showToast(err.message ?? "Failed to update category");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(id: number) {
    setWorking(id);
    try {
      await deleteCategory(id);
      setConfirmDelete(null);
      await load();
      showToast("Category deleted");
    } catch (err: any) {
      showToast(err.message ?? "Failed to delete category");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The AI reads these categories — including their descriptions — when deciding where to file each article.
            Add new categories here and the AI will start using them immediately.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditId(null); }}
          className="text-sm bg-foreground text-background px-4 py-2 rounded-lg hover:opacity-80"
        >
          + New Category
        </button>
      </div>

      {showAdd && (
        <div className="border rounded-xl p-4 mb-6 bg-muted/30 space-y-3">
          <h2 className="font-semibold text-sm">New Category</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="e.g. Local Heroes"
                value={newName}
                onChange={(e) => handleNewNameChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Slug (auto-generated)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="e.g. local-heroes"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Description — <span className="text-foreground font-medium">the AI uses this to decide what belongs in this category</span>
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              placeholder="e.g. Stories about local community members doing exceptional things — volunteers, unsung heroes, community champions"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Colour</label>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border"
              />
            </div>
            <div className="flex-1" />
            <button onClick={() => setShowAdd(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || working === "new"}
              className="text-sm bg-foreground text-background px-4 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-40"
            >
              {working === "new" ? "Saving…" : "Create Category"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id} className="border rounded-xl p-4">
              {editId === cat.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Name</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Slug</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Description — <span className="text-foreground font-medium">the AI uses this to decide what belongs here</span>
                    </label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Colour</label>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border"
                      />
                    </div>
                    <div className="flex-1" />
                    <button onClick={cancelEdit} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(cat.id)}
                      disabled={working === cat.id}
                      className="text-sm bg-foreground text-background px-4 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-40"
                    >
                      {working === cat.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div className="font-medium text-sm">{cat.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{cat.slug}</div>
                      {cat.description ? (
                        <div className="text-sm text-muted-foreground mt-1">{cat.description}</div>
                      ) : (
                        <div className="text-sm text-orange-500 mt-1 italic">No description — add one so the AI knows what to file here</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5"
                    >
                      Edit
                    </button>
                    {confirmDelete === cat.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Delete this category?</span>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={working === cat.id}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-40"
                        >
                          {working === cat.id ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground hover:text-foreground">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(cat.id)}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5"
                      >
                        Delete
                      </button>
                    )}
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
