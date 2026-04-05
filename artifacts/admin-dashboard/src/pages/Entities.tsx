import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  requestUploadUrl,
  type Entity,
  type EntityType,
  type CreateEntityInput,
} from "@/lib/api";

const TYPE_LABELS: Record<EntityType, string> = {
  organisation: "Organisation",
  person: "Person",
  venue: "Venue",
  team: "Team",
  event: "Event",
};

const TYPE_COLORS: Record<EntityType, string> = {
  organisation: "bg-blue-100 text-blue-700",
  person: "bg-purple-100 text-purple-700",
  venue: "bg-amber-100 text-amber-700",
  team: "bg-green-100 text-green-700",
  event: "bg-rose-100 text-rose-700",
};

const EMPTY_FORM: CreateEntityInput = {
  name: "",
  aliases: [],
  type: "organisation",
  imageUrl: null,
  website: null,
  description: null,
};

function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadImage(file: File): Promise<string | null> {
    setIsUploading(true);
    setUploadError(null);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type || "image/jpeg",
      });
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      return `/api/storage${objectPath}`;
    } catch (err: any) {
      setUploadError(err.message ?? "Image upload failed");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  return { uploadImage, isUploading, uploadError };
}

interface EntityFormProps {
  initial: CreateEntityInput;
  onSave: (data: CreateEntityInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function EntityForm({ initial, onSave, onCancel, isSaving }: EntityFormProps) {
  const [form, setForm] = useState<CreateEntityInput>(initial);
  const [aliasInput, setAliasInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.imageUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading, uploadError } = useImageUpload();

  function set<K extends keyof CreateEntityInput>(key: K, val: CreateEntityInput[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addAlias() {
    const trimmed = aliasInput.trim();
    if (!trimmed || form.aliases.includes(trimmed)) return;
    set("aliases", [...form.aliases, trimmed]);
    setAliasInput("");
  }

  function removeAlias(alias: string) {
    set("aliases", form.aliases.filter((a) => a !== alias));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    const path = await uploadImage(file);
    if (path) {
      set("imageUrl", path);
    } else {
      setPreviewUrl(form.imageUrl ?? null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image upload */}
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted cursor-pointer overflow-hidden flex-shrink-0"
          onClick={() => fileRef.current?.click()}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Entity" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-muted-foreground">🖼️</span>
          )}
        </div>
        <div className="flex-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "Upload Image"}
          </button>
          <p className="text-xs text-muted-foreground mt-1">Logo, headshot, or venue photo. Used as article header when this entity is mentioned.</p>
          {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Name *</label>
        <input
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Tallaght Rehabilitation"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Type *</label>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value as EntityType)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Aliases */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Also known as</label>
        <div className="flex gap-2 mb-2">
          <input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
            placeholder="e.g. Tallaght Rehab, TR"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={addAlias}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            Add
          </button>
        </div>
        {form.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.aliases.map((alias) => (
              <span key={alias} className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                {alias}
                <button type="button" onClick={() => removeAlias(alias)} className="hover:text-destructive leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">Alternate names and abbreviations — all are checked when matching articles.</p>
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Description</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          rows={2}
          placeholder="Brief description used for AI context"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Website */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">Website</label>
        <input
          type="url"
          value={form.website ?? ""}
          onChange={(e) => set("website", e.target.value || null)}
          placeholder="https://example.ie"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Entity"}
        </button>
      </div>
    </form>
  );
}

export default function Entities() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["entities"],
    queryFn: getEntities,
  });

  const createMut = useMutation({
    mutationFn: createEntity,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entities"] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEntityInput> }) => updateEntity(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entities"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entities"] }); setDeleting(null); },
  });

  const filtered = entities.filter((e) => {
    const matchType = typeFilter === "all" || e.type === typeFilter;
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entity Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Local organisations, people, venues, and clubs — their images auto-appear on articles that mention them.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
        >
          <span>+</span> Add Entity
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or alias…"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EntityType | "all")}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Add form (inline) */}
      {showForm && !editing && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold mb-4">New Entity</h2>
          <EntityForm
            initial={EMPTY_FORM}
            onSave={async (data) => { await createMut.mutateAsync(data); }}
            onCancel={() => setShowForm(false)}
            isSaving={createMut.isPending}
          />
          {createMut.isError && (
            <p className="text-sm text-red-500 mt-2">{(createMut.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Entity grid */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {entities.length === 0 ? (
            <>
              <div className="text-5xl mb-3">🏛️</div>
              <p className="font-medium text-foreground">No entities yet</p>
              <p className="text-sm mt-1">Add your first local club, venue, or organisation above.</p>
            </>
          ) : (
            <p>No entities match your search.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((entity) => (
            <div key={entity.id}>
              {/* Edit form (inline per entity) */}
              {editing?.id === entity.id ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold mb-4">Edit: {entity.name}</h2>
                  <EntityForm
                    initial={{
                      name: entity.name,
                      aliases: entity.aliases,
                      type: entity.type,
                      imageUrl: entity.imageUrl,
                      website: entity.website,
                      description: entity.description,
                    }}
                    onSave={async (data) => {
                      await updateMut.mutateAsync({ id: entity.id, data });
                    }}
                    onCancel={() => setEditing(null)}
                    isSaving={updateMut.isPending}
                  />
                  {updateMut.isError && (
                    <p className="text-sm text-red-500 mt-2">{(updateMut.error as Error).message}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-card/90 transition-colors">
                  {/* Image */}
                  <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden border border-border">
                    {entity.imageUrl ? (
                      <img src={entity.imageUrl} alt={entity.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-muted-foreground">
                        {entity.type === "person" ? "👤" : entity.type === "venue" ? "📍" : entity.type === "team" ? "⚽" : entity.type === "event" ? "📅" : "🏢"}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{entity.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[entity.type]}`}>
                        {TYPE_LABELS[entity.type]}
                      </span>
                      {!entity.imageUrl && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">No image</span>
                      )}
                    </div>
                    {entity.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Also known as: {entity.aliases.join(", ")}
                      </p>
                    )}
                    {entity.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{entity.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {entity.website && (
                      <a
                        href={entity.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors text-muted-foreground"
                      >
                        🔗 Website
                      </a>
                    )}
                    <button
                      onClick={() => setEditing(entity)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(entity)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {entities.length > 0 && (
        <div className="mt-5 p-3 rounded-lg bg-muted text-xs text-muted-foreground flex gap-4">
          <span><strong className="text-foreground">{entities.length}</strong> entities total</span>
          <span><strong className="text-foreground">{entities.filter((e) => e.imageUrl).length}</strong> with images</span>
          <span><strong className="text-foreground">{entities.filter((e) => !e.imageUrl).length}</strong> missing image</span>
          {Object.entries(TYPE_LABELS).map(([k, v]) => {
            const count = entities.filter((e) => e.type === k).length;
            if (!count) return null;
            return <span key={k}>{v}: <strong className="text-foreground">{count}</strong></span>;
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Entity</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <strong className="text-foreground">{deleting.name}</strong>? This won't affect articles that have already been published.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleting.id)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
