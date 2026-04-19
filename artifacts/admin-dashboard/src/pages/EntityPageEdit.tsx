import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEntityPage,
  getEntityPages,
  createEntityPage,
  updateEntityPage,
  publishEntityPage,
  generateEntityPage,
  deleteEntityPage,
  requestUploadUrl,
  uploadEntityPageTrends,
  rescanEntityPagePosts,
  scanEntityPageRelationsApi,
  addEntityPageRelation,
  removeEntityPageRelation,
  type EntityPageType,
  type EntityPageAiContext,
  type CreateEntityPageInput,
  type TrendsData,
  type RescanPostsResult,
  type ScanRelationsResult,
  type RelatedEntityPage,
} from "@/lib/api";

const ENTITY_TYPES: { value: EntityPageType; label: string }[] = [
  { value: "sports_club", label: "Sports Club" },
  { value: "venue", label: "Venue" },
  { value: "place", label: "Place" },
  { value: "business", label: "Business" },
  { value: "organisation", label: "Organisation" },
  { value: "event_series", label: "Event Series" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground";
const TEXTAREA = INPUT + " resize-y min-h-[80px]";

export default function EntityPageEdit() {
  const [, params] = useRoute("/entity-pages/:id");
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = params?.id === "new";
  const pageId = isNew ? null : parseInt(params?.id ?? "", 10);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["entity-page", pageId],
    queryFn: () => getEntityPage(pageId!),
    enabled: !isNew && pageId !== null,
  });

  const { data: allEntityPages } = useQuery({
    queryKey: ["entity-pages-list"],
    queryFn: () => getEntityPages(),
    enabled: !isNew && pageId !== null,
  });

  const [form, setForm] = useState<CreateEntityPageInput>({
    name: "",
    slug: "",
    entityType: "sports_club",
    aliases: [],
    shortDescription: null,
    address: null,
    directions: null,
    website: null,
    phone: null,
    openingHours: null,
    photos: [],
    aiContext: {},
    generatedBody: null,
    seoTitle: null,
    metaDescription: null,
    status: "draft",
    primaryCategoryId: null,
  });
  const [aliasInput, setAliasInput] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTrendsUploading, setIsTrendsUploading] = useState(false);
  const [trendsUploadError, setTrendsUploadError] = useState<string | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [trendsSummary, setTrendsSummary] = useState<string>("");
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanResult, setRescanResult] = useState<RescanPostsResult | null>(null);
  const [isScanningRelations, setIsScanningRelations] = useState(false);
  const [scanRelationsResult, setScanRelationsResult] = useState<ScanRelationsResult | null>(null);
  const [relationsError, setRelationsError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        slug: existing.slug,
        entityType: existing.entityType,
        aliases: existing.aliases,
        shortDescription: existing.shortDescription,
        address: existing.address,
        directions: existing.directions,
        website: existing.website,
        phone: existing.phone,
        openingHours: existing.openingHours,
        photos: existing.photos,
        aiContext: existing.aiContext ?? {},
        generatedBody: existing.generatedBody,
        seoTitle: existing.seoTitle,
        metaDescription: existing.metaDescription,
        status: existing.status,
        primaryCategoryId: existing.primaryCategoryId,
      });
      setAliasInput((existing.aliases ?? []).join(", "));
      setSlugManual(true);
      if (existing.trendsData) setTrendsData(existing.trendsData);
      if (existing.trendsSummary) setTrendsSummary(existing.trendsSummary);
    }
  }, [existing]);

  function set<K extends keyof CreateEntityPageInput>(key: K, value: CreateEntityPageInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCtx(key: keyof EntityPageAiContext, value: string) {
    setForm((f) => ({ ...f, aiContext: { ...(f.aiContext ?? {}), [key]: value } }));
  }

  function handleNameChange(v: string) {
    set("name", v);
    if (!slugManual) set("slug", slugify(v));
  }

  function handleAliasBlur() {
    const parts = aliasInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    set("aliases", parts);
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const { uploadURL, objectPath } = await requestUploadUrl({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        });
        const res = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "image/jpeg" },
        });
        if (res.ok) newPhotos.push(`/api/storage${objectPath}`);
      } catch {
        // skip failed uploads
      }
    }
    set("photos", [...(form.photos ?? []), ...newPhotos]);
    setIsUploading(false);
  }

  function removePhoto(url: string) {
    set("photos", (form.photos ?? []).filter((p) => p !== url));
  }

  async function handleCsvUpload(file: File | null) {
    if (!file || isNew || !pageId) return;
    setIsTrendsUploading(true);
    setTrendsUploadError(null);
    try {
      const csvContent = await file.text();
      const result = await uploadEntityPageTrends(pageId, csvContent);
      setTrendsData(result.trendsData);
      setTrendsSummary(result.trendsSummary);
      qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
    } catch (err: any) {
      setTrendsUploadError(err.message ?? "Upload failed");
    } finally {
      setIsTrendsUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form };
      if (isNew) {
        const created = await createEntityPage(payload);
        qc.invalidateQueries({ queryKey: ["entity-pages"] });
        navigate(`/entity-pages/${created.id}`);
      } else {
        await updateEntityPage(pageId!, payload);
        qc.invalidateQueries({ queryKey: ["entity-pages"] });
        qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
      }
    } catch (err: any) {
      setSaveError(err.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate() {
    if (isNew) {
      setSaveError("Save the page first before generating content.");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await handleSave();
      const result = await generateEntityPage(pageId!);
      set("generatedBody", result.generatedBody);
      if (!form.seoTitle && result.generatedSeoTitle) set("seoTitle", result.generatedSeoTitle);
      if (!form.metaDescription && result.generatedMetaDescription)
        set("metaDescription", result.generatedMetaDescription);
      qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
    } catch (err: any) {
      setGenerateError(err.message ?? "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePublishToggle() {
    if (isNew) return;
    try {
      const updated = await publishEntityPage(pageId!);
      set("status", updated.status as "draft" | "published");
      qc.invalidateQueries({ queryKey: ["entity-pages"] });
      qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to toggle status");
    }
  }

  async function handleDelete() {
    if (isNew || !pageId) return;
    setIsDeleting(true);
    try {
      await deleteEntityPage(pageId);
      qc.invalidateQueries({ queryKey: ["entity-pages"] });
      navigate("/entity-pages");
    } catch (err: any) {
      setSaveError(err.message ?? "Delete failed");
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const ctx = (form.aiContext ?? {}) as EntityPageAiContext;

  if (!isNew && isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("/entity-pages");
            }}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Entity Pages
          </a>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold text-foreground">
            {isNew ? "New Entity Page" : form.name || "Edit Entity Page"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handlePublishToggle}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                form.status === "published"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              {form.status === "published" ? "Published" : "Draft"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      <div className="space-y-5">
        {/* Core info */}
        <Section title="Core Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" hint="Full official name">
              <input
                className={INPUT}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Shamrock Rovers FC"
              />
            </Field>
            <Field label="Entity Type">
              <select
                className={INPUT}
                value={form.entityType}
                onChange={(e) => set("entityType", e.target.value as EntityPageType)}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Slug" hint="URL path: /place/[slug]">
              <input
                className={INPUT}
                value={form.slug ?? ""}
                onChange={(e) => {
                  setSlugManual(true);
                  set("slug", e.target.value);
                }}
                placeholder="e.g. shamrock-rovers-fc"
              />
            </Field>
            <Field label="Aliases" hint="Comma-separated, used to match articles">
              <input
                className={INPUT}
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onBlur={handleAliasBlur}
                placeholder="e.g. Rovers, The Hoops, SRFC"
              />
            </Field>
          </div>

          <Field label="Short Description" hint="1–2 sentences, shown in admin list view">
            <textarea
              className={TEXTAREA}
              style={{ minHeight: 60 }}
              value={form.shortDescription ?? ""}
              onChange={(e) => set("shortDescription", e.target.value || null)}
              placeholder="Brief summary of this entity"
            />
          </Field>
        </Section>

        {/* Contact & Location */}
        <Section title="Contact &amp; Location">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Address">
              <textarea
                className={TEXTAREA}
                style={{ minHeight: 60 }}
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value || null)}
                placeholder="Full postal address"
              />
            </Field>
            <Field label="Directions" hint="How to get there from Tallaght town centre">
              <textarea
                className={TEXTAREA}
                style={{ minHeight: 60 }}
                value={form.directions ?? ""}
                onChange={(e) => set("directions", e.target.value || null)}
                placeholder="e.g. 5 min walk from The Square..."
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Website">
              <input
                className={INPUT}
                value={form.website ?? ""}
                onChange={(e) => set("website", e.target.value || null)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Phone">
              <input
                className={INPUT}
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value || null)}
                placeholder="+353 1 ..."
              />
            </Field>
            <Field label="Opening Hours">
              <input
                className={INPUT}
                value={form.openingHours ?? ""}
                onChange={(e) => set("openingHours", e.target.value || null)}
                placeholder="Mon–Fri 9am–5pm"
              />
            </Field>
          </div>
        </Section>

        {/* Type-specific fields */}
        {(form.entityType === "sports_club" || form.entityType === "venue") && (
          <Section
            title={form.entityType === "sports_club" ? "Club Details" : "Venue Details"}
          >
            {form.entityType === "sports_club" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Home Ground">
                  <input
                    className={INPUT}
                    value={ctx.homeGround ?? ""}
                    onChange={(e) => setCtx("homeGround", e.target.value)}
                    placeholder="e.g. Tallaght Stadium"
                  />
                </Field>
                <Field label="Founded">
                  <input
                    className={INPUT}
                    value={ctx.founded ?? ""}
                    onChange={(e) => setCtx("founded", e.target.value)}
                    placeholder="e.g. 1901"
                  />
                </Field>
                <Field label="Home Kit Colours">
                  <input
                    className={INPUT}
                    value={ctx.homeKit ?? ""}
                    onChange={(e) => setCtx("homeKit", e.target.value)}
                    placeholder="e.g. Green and white hoops"
                  />
                </Field>
                <Field label="Away Kit Colours">
                  <input
                    className={INPUT}
                    value={ctx.awayKit ?? ""}
                    onChange={(e) => setCtx("awayKit", e.target.value)}
                    placeholder="e.g. All white"
                  />
                </Field>
                <Field label="League / Competition">
                  <input
                    className={INPUT}
                    value={ctx.league ?? ""}
                    onChange={(e) => setCtx("league", e.target.value)}
                    placeholder="e.g. League of Ireland Premier Division"
                  />
                </Field>
              </div>
            )}
            {form.entityType === "venue" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Capacity">
                  <input
                    className={INPUT}
                    value={ctx.capacity ?? ""}
                    onChange={(e) => setCtx("capacity", e.target.value)}
                    placeholder="e.g. 6,000"
                  />
                </Field>
                <Field label="Surface Type">
                  <input
                    className={INPUT}
                    value={ctx.surface ?? ""}
                    onChange={(e) => setCtx("surface", e.target.value)}
                    placeholder="e.g. Grass / Artificial / Indoor"
                  />
                </Field>
              </div>
            )}
          </Section>
        )}

        {form.entityType === "place" && (
          <Section title="Place Details">
            <Field label="Departments / Services">
              <textarea
                className={TEXTAREA}
                value={ctx.departments ?? ""}
                onChange={(e) => setCtx("departments", e.target.value)}
                placeholder="e.g. Library, Citizens Information, Health Centre..."
              />
            </Field>
          </Section>
        )}

        {/* AI Context */}
        <Section title="AI Context">
          <Field
            label="DALL-E Style"
            hint="One-liner used when generating images for articles mentioning this entity"
          >
            <input
              className={INPUT}
              value={ctx.dalleStyle ?? ""}
              onChange={(e) => setCtx("dalleStyle", e.target.value)}
              placeholder="e.g. green and white hooped jersey, Tallaght Stadium background, bright daytime"
            />
          </Field>
          <Field label="Additional Context" hint="Any extra facts useful for AI article writing">
            <textarea
              className={TEXTAREA}
              value={ctx.additionalContext ?? ""}
              onChange={(e) => setCtx("additionalContext", e.target.value)}
              placeholder="Any other details the AI should know about this entity"
            />
          </Field>
        </Section>

        {/* Photos */}
        <Section title="Photos">
          <div className="flex flex-wrap gap-3 mb-3">
            {(form.photos ?? []).map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt={`photo ${i + 1}`}
                  className="w-24 h-24 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePhotoUpload(e.target.files)}
          />
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "+ Upload Photos"}
          </button>
        </Section>

        {/* Generated Page Body */}
        <Section title="Page Content">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              AI-generated page body (Markdown). Save first, then generate.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isNew}
              className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⟳</span> Generating…
                </>
              ) : (
                "✦ Generate Page"
              )}
            </button>
          </div>
          {generateError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
              {generateError}
            </div>
          )}
          <textarea
            className={TEXTAREA}
            style={{ minHeight: 280 }}
            value={form.generatedBody ?? ""}
            onChange={(e) => set("generatedBody", e.target.value || null)}
            placeholder="Page body will appear here after generation. You can edit it freely."
          />
        </Section>

        {/* SEO */}
        <Section title="SEO">
          <Field label="SEO Title" hint="60 characters max">
            <input
              className={INPUT}
              value={form.seoTitle ?? ""}
              onChange={(e) => set("seoTitle", e.target.value || null)}
              maxLength={80}
              placeholder="e.g. Shamrock Rovers FC — Tallaght's Premier League Club"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(form.seoTitle ?? "").length}/60
            </p>
          </Field>
          <Field label="Meta Description" hint="155 characters max">
            <textarea
              className={TEXTAREA}
              style={{ minHeight: 60 }}
              value={form.metaDescription ?? ""}
              onChange={(e) => set("metaDescription", e.target.value || null)}
              maxLength={200}
              placeholder="Brief description for Google search results…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(form.metaDescription ?? "").length}/155
            </p>
          </Field>
        </Section>

        {/* Search Trends */}
        {!isNew && (
          <Section title="Search Trends">
            <p className="text-xs text-muted-foreground mb-4">
              Upload a Google Trends CSV to help the AI use the phrases people actually search. Go to{" "}
              <a
                href="https://trends.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                trends.google.com
              </a>
              , search this entity's name, set region to <strong>Ireland</strong> and time to{" "}
              <strong>Past 12 months</strong>, then download the CSV (⬇ button top-right of the page).
            </p>

            <div className="flex items-center gap-3 mb-4">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleCsvUpload(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={isTrendsUploading}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isTrendsUploading ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span> Analysing…
                  </>
                ) : (
                  "↑ Upload Trends CSV"
                )}
              </button>
              {trendsData && (
                <span className="text-xs text-muted-foreground">
                  Last updated:{" "}
                  {new Date(trendsData.lastUploadedAt).toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>

            {trendsUploadError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                {trendsUploadError}
              </div>
            )}

            {trendsData && (
              <div className="space-y-4">
                {/* AI Summary — editable */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    AI SEO Briefing
                  </label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Review and edit this before saving — it will influence how the AI writes articles about this entity.
                  </p>
                  <textarea
                    className={TEXTAREA}
                    style={{ minHeight: 100 }}
                    value={trendsSummary}
                    onChange={(e) => setTrendsSummary(e.target.value)}
                    placeholder="AI-generated SEO briefing will appear here after upload."
                  />
                  <button
                    onClick={async () => {
                      if (!pageId) return;
                      try {
                        await updateEntityPage(pageId, { trendsSummary });
                        qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="mt-2 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Save briefing edits
                  </button>
                </div>

                {/* Query preview cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trendsData.risingQueries.length > 0 && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">📈 Rising Searches</p>
                      <ul className="space-y-1">
                        {trendsData.risingQueries.slice(0, 5).map((q, i) => (
                          <li key={i} className="flex items-center justify-between">
                            <span className="text-xs text-foreground">{q.query}</span>
                            <span className={`text-xs font-semibold ${q.changePercent >= 5000 ? "text-orange-600" : "text-green-700"}`}>
                              {q.changePercent >= 5000 ? "Breakout" : `+${q.changePercent}%`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {trendsData.topQueries.length > 0 && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">🔍 Top Searches</p>
                      <ul className="space-y-1">
                        {trendsData.topQueries.slice(0, 5).map((q, i) => (
                          <li key={i} className="text-xs text-foreground">{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {trendsData.peakMonths.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Peak months:</span>
                    {trendsData.peakMonths.map((m) => (
                      <span
                        key={m}
                        className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Linked articles */}
        {!isNew && (
          <Section title="Linked Articles">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                Articles that mention this entity appear in "Recent Coverage" on the public page.
                New articles are linked automatically. Use the button to backfill older articles.
              </p>
              <button
                type="button"
                disabled={isRescanning}
                onClick={async () => {
                  if (!pageId) return;
                  setIsRescanning(true);
                  setRescanResult(null);
                  try {
                    const result = await rescanEntityPagePosts(pageId);
                    setRescanResult(result);
                    qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
                  } catch {
                    setRescanResult(null);
                  } finally {
                    setIsRescanning(false);
                  }
                }}
                className="ml-4 flex-shrink-0 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isRescanning ? "Scanning…" : "Find Related Articles"}
              </button>
            </div>
            {rescanResult && (
              <div className="mb-3 text-xs rounded-lg px-3 py-2 bg-green-50 text-green-700 border border-green-200">
                Scan complete — {rescanResult.linked} new article{rescanResult.linked !== 1 ? "s" : ""} linked
                {rescanResult.skipped > 0 ? `, ${rescanResult.skipped} already linked` : ""}.
              </div>
            )}
            {existing?.linkedArticles && existing.linkedArticles.length > 0 ? (
              <div className="divide-y divide-border">
                {existing.linkedArticles.map((a) => (
                  <div key={a.postId} className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{a.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {a.publishedAt
                        ? new Date(a.publishedAt).toLocaleDateString("en-IE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No articles linked yet. Click "Find Related Articles" to scan all published posts.
              </p>
            )}
          </Section>
        )}

        {/* Related pages */}
        {!isNew && (
          <Section title="Related Pages">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                Entity pages that are related to this one appear as "Related Places" on the public page.
                The system auto-detects relations by scanning the page body after Generate.
              </p>
              <button
                type="button"
                disabled={isScanningRelations}
                onClick={async () => {
                  if (!pageId) return;
                  setIsScanningRelations(true);
                  setScanRelationsResult(null);
                  setRelationsError(null);
                  try {
                    const result = await scanEntityPageRelationsApi(pageId);
                    setScanRelationsResult(result);
                    qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
                  } catch {
                    setRelationsError("Scan failed");
                  } finally {
                    setIsScanningRelations(false);
                  }
                }}
                className="ml-4 flex-shrink-0 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isScanningRelations ? "Scanning…" : "Find Related Pages"}
              </button>
            </div>
            {scanRelationsResult && (
              <div className="mb-3 text-xs rounded-lg px-3 py-2 bg-green-50 text-green-700 border border-green-200">
                Scan complete — {scanRelationsResult.linked} new relation{scanRelationsResult.linked !== 1 ? "s" : ""} found
                {scanRelationsResult.skipped > 0 ? `, ${scanRelationsResult.skipped} already linked` : ""}.
              </div>
            )}
            {relationsError && (
              <div className="mb-3 text-xs rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">
                {relationsError}
              </div>
            )}
            {existing?.relatedPages && existing.relatedPages.length > 0 ? (
              <div className="divide-y divide-border mb-4">
                {existing.relatedPages.map((rp) => (
                  <div key={rp.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {rp.photos?.[0] && (
                        <img src={rp.photos[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{rp.name}</span>
                        {rp.relationLabel && (
                          <span className="ml-2 text-xs text-muted-foreground">({rp.relationLabel})</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!pageId) return;
                        try {
                          await removeEntityPageRelation(pageId, rp.id);
                          qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
                        } catch {
                          setRelationsError("Failed to remove relation");
                        }
                      }}
                      className="flex-shrink-0 text-xs text-red-600 hover:text-red-800 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic mb-4">
                No related pages yet. Click "Find Related Pages" to auto-detect from the body text, or add one manually below.
              </p>
            )}
            {/* Manual add */}
            {allEntityPages && allEntityPages.filter((p) => p.id !== pageId).length > 0 && (
              <div className="flex gap-2 mt-2">
                <select
                  id="manual-related-select"
                  className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  defaultValue=""
                >
                  <option value="" disabled>Add related page…</option>
                  {allEntityPages
                    .filter((p) => p.id !== pageId && !(existing?.relatedPages ?? []).some((r) => r.id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!pageId) return;
                    const sel = document.getElementById("manual-related-select") as HTMLSelectElement;
                    const val = parseInt(sel.value, 10);
                    if (isNaN(val)) return;
                    setRelationsError(null);
                    try {
                      await addEntityPageRelation(pageId, val);
                      sel.value = "";
                      qc.invalidateQueries({ queryKey: ["entity-page", pageId] });
                    } catch {
                      setRelationsError("Failed to add relation");
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Danger zone */}
        {!isNew && (
          <div className="border border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Deleting this entity page is permanent and cannot be undone.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Delete Entity Page
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete entity page?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong>{form.name}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
