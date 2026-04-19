import { Router } from "express";
import { db } from "@workspace/db";
import {
  entityPagesTable,
  entityPageArticlesTable,
  entityPageRelationsTable,
  insertEntityPageSchema,
  postsTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import OpenAI from "openai";
import { getSettingValue } from "./settings";
import { scanEntityPageRelations } from "../lib/entity-page-linker";

const router = Router();

async function getOpenAI(): Promise<OpenAI> {
  const apiKey = (await getSettingValue("openai_api_key")) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured");
  return new OpenAI({ apiKey });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET /admin/entity-pages — list all with article count
router.get("/admin/entity-pages", async (req, res) => {
  try {
    const pages = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        slug: entityPagesTable.slug,
        entityType: entityPagesTable.entityType,
        status: entityPagesTable.status,
        shortDescription: entityPagesTable.shortDescription,
        seoTitle: entityPagesTable.seoTitle,
        publishedAt: entityPagesTable.publishedAt,
        createdAt: entityPagesTable.createdAt,
        updatedAt: entityPagesTable.updatedAt,
        articleCount: sql<number>`(
          SELECT COUNT(*) FROM entity_page_articles
          WHERE entity_page_id = ${entityPagesTable.id}
        )::int`,
      })
      .from(entityPagesTable)
      .orderBy(desc(entityPagesTable.updatedAt));
    res.json(pages);
  } catch (err) {
    req.log.error(err, "Failed to list entity pages");
    res.status(500).json({ error: "Failed to list entity pages" });
  }
});

// GET /admin/entity-pages/:id — get single entity page
router.get("/admin/entity-pages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [page] = await db
      .select()
      .from(entityPagesTable)
      .where(eq(entityPagesTable.id, id));
    if (!page) return res.status(404).json({ error: "Entity page not found" });

    const linkedArticles = await db
      .select({
        postId: entityPageArticlesTable.postId,
        linkedAt: entityPageArticlesTable.linkedAt,
        title: postsTable.title,
        slug: postsTable.slug,
        publishedAt: postsTable.publishedAt,
      })
      .from(entityPageArticlesTable)
      .innerJoin(postsTable, eq(entityPageArticlesTable.postId, postsTable.id))
      .where(eq(entityPageArticlesTable.entityPageId, id))
      .orderBy(desc(postsTable.publishedAt));

    const relatedPages = await fetchRelatedPages(id);

    res.json({ ...page, linkedArticles, relatedPages });
  } catch (err) {
    req.log.error(err, "Failed to get entity page");
    res.status(500).json({ error: "Failed to get entity page" });
  }
});

// POST /admin/entity-pages — create
router.post("/admin/entity-pages", async (req, res) => {
  try {
    const body = insertEntityPageSchema.parse({
      ...req.body,
      slug: req.body.slug || slugify(req.body.name || ""),
    });
    const [page] = await db.insert(entityPagesTable).values(body).returning();
    res.status(201).json(page);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    req.log.error(err, "Failed to create entity page");
    res.status(500).json({ error: "Failed to create entity page" });
  }
});

// PUT /admin/entity-pages/:id — update
router.put("/admin/entity-pages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const body = insertEntityPageSchema.partial().parse(req.body);
    const [page] = await db
      .update(entityPagesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(entityPagesTable.id, id))
      .returning();
    if (!page) return res.status(404).json({ error: "Entity page not found" });
    res.json(page);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    req.log.error(err, "Failed to update entity page");
    res.status(500).json({ error: "Failed to update entity page" });
  }
});

// POST /admin/entity-pages/:id/publish — toggle publish status
router.post("/admin/entity-pages/:id/publish", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(entityPagesTable).where(eq(entityPagesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Entity page not found" });

    const newStatus = existing.status === "published" ? "draft" : "published";
    const [page] = await db
      .update(entityPagesTable)
      .set({
        status: newStatus,
        publishedAt: newStatus === "published" ? new Date() : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(entityPagesTable.id, id))
      .returning();
    res.json(page);
  } catch (err) {
    req.log.error(err, "Failed to toggle publish status");
    res.status(500).json({ error: "Failed to toggle publish status" });
  }
});

// POST /admin/entity-pages/:id/generate — AI generation
router.post("/admin/entity-pages/:id/generate", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [page] = await db.select().from(entityPagesTable).where(eq(entityPagesTable.id, id));
    if (!page) return res.status(404).json({ error: "Entity page not found" });

    const aiCtx = (page.aiContext as Record<string, any>) ?? {};
    const typeLabel: Record<string, string> = {
      sports_club: "sports club",
      venue: "venue",
      place: "place",
      business: "local business",
      organisation: "organisation",
      event_series: "event series",
    };

    const contextLines: string[] = [];
    if (page.shortDescription) contextLines.push(`Short description: ${page.shortDescription}`);
    if (page.address) contextLines.push(`Address: ${page.address}`);
    if (page.directions) contextLines.push(`How to get there: ${page.directions}`);
    if (page.website) contextLines.push(`Website: ${page.website}`);
    if (page.phone) contextLines.push(`Phone: ${page.phone}`);
    if (page.openingHours) contextLines.push(`Opening hours: ${page.openingHours}`);
    if (page.aliases?.length) contextLines.push(`Also known as: ${page.aliases.join(", ")}`);
    if (aiCtx.homeGround) contextLines.push(`Home ground: ${aiCtx.homeGround}`);
    if (aiCtx.homeKit) contextLines.push(`Home kit: ${aiCtx.homeKit}`);
    if (aiCtx.awayKit) contextLines.push(`Away kit: ${aiCtx.awayKit}`);
    if (aiCtx.founded) contextLines.push(`Founded: ${aiCtx.founded}`);
    if (aiCtx.league) contextLines.push(`League/competition: ${aiCtx.league}`);
    if (aiCtx.capacity) contextLines.push(`Capacity: ${aiCtx.capacity}`);
    if (aiCtx.surface) contextLines.push(`Surface: ${aiCtx.surface}`);
    if (aiCtx.departments) contextLines.push(`Departments/services: ${aiCtx.departments}`);
    if (aiCtx.additionalContext) contextLines.push(`Additional info: ${aiCtx.additionalContext}`);

    // Top queries from Google Trends — vocabulary the AI can draw on naturally in the body
    const trendsDataRaw = page.trendsData as any;
    const topQueries: string[] = trendsDataRaw?.topQueries ?? [];
    const topQueriesBlock = topQueries.length > 0
      ? `\nEstablished search terms people use for ${page.name} (from Google Trends — weave relevant phrases naturally into the body where they fit, do not list them or force every one in):\n${topQueries.map((q) => `- "${q}"`).join("\n")}`
      : "";

    const systemPrompt = `You are a local content writer for What's Up Tallaght, a community news platform serving Tallaght, Dublin. Write warm, informative, SEO-friendly content about local places, clubs, and businesses. Write in third person. Be accurate, factual, and community-focused. Do not invent facts not provided.`;

    const userPrompt = `Write a 450–550 word page about "${page.name}", a ${typeLabel[page.entityType] ?? page.entityType} in Tallaght, Dublin.

Known facts:
${contextLines.join("\n")}${topQueriesBlock}

Requirements:
- Open with a strong introductory paragraph establishing what this is and why it matters to the Tallaght community
- Cover key facts naturally in flowing prose (not bullet points)
- Include a practical "Visiting" or "Getting involved" section near the end with address/directions/contact if available
- End with a sentence connecting it to the broader Tallaght community
- Use Markdown headings (## only) sparingly — one or two at most
- Do not fabricate statistics or awards

Then on a new line after the body, output exactly:
SEO_TITLE: [60-char max title for Google]
META_DESCRIPTION: [155-char max description for Google]`;

    const openai = await getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    const seoTitleMatch = raw.match(/^SEO_TITLE:\s*(.+)$/m);
    const metaMatch = raw.match(/^META_DESCRIPTION:\s*(.+)$/m);
    const generatedSeoTitle = seoTitleMatch?.[1]?.trim() ?? null;
    const generatedMetaDescription = metaMatch?.[1]?.trim() ?? null;
    const generatedBody = raw
      .replace(/^SEO_TITLE:.*$/m, "")
      .replace(/^META_DESCRIPTION:.*$/m, "")
      .trim();

    const [updated] = await db
      .update(entityPagesTable)
      .set({
        generatedBody,
        seoTitle: page.seoTitle || generatedSeoTitle,
        metaDescription: page.metaDescription || generatedMetaDescription,
        updatedAt: new Date(),
      })
      .where(eq(entityPagesTable.id, id))
      .returning();

    // Auto-scan for related entity pages after body is saved (non-blocking)
    scanEntityPageRelations(id).catch((err) =>
      req.log.warn({ err, entityPageId: id }, "Auto relation scan failed (non-fatal)"),
    );

    res.json({
      generatedBody,
      generatedSeoTitle,
      generatedMetaDescription,
      page: updated,
    });
  } catch (err) {
    req.log.error(err, "Failed to generate entity page content");
    res.status(500).json({ error: "Failed to generate entity page content" });
  }
});

// POST /admin/entity-pages/:id/upload-trends — parse Google Trends CSV + AI summary
router.post("/admin/entity-pages/:id/upload-trends", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [page] = await db.select().from(entityPagesTable).where(eq(entityPagesTable.id, id));
    if (!page) return res.status(404).json({ error: "Entity page not found" });

    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== "string") {
      return res.status(400).json({ error: "csvContent is required" });
    }

    // ── Parse Google Trends CSV ──────────────────────────────────────────────
    const trendsData = parseTrendsCSV(csvContent);

    // ── AI summary ──────────────────────────────────────────────────────────
    const openai = await getOpenAI();

    const breakoutQueries = trendsData.risingQueries
      .filter((q) => q.changePercent >= 5000)
      .map((q) => `"${q.query}"`)
      .join(", ");
    const risingList = trendsData.risingQueries
      .filter((q) => q.changePercent < 5000)
      .slice(0, 8)
      .map((q) => `"${q.query}" (+${q.changePercent}%)`)
      .join(", ");
    const topList = trendsData.topQueries.slice(0, 6).join(", ");
    const peakList = trendsData.peakMonths.join(", ");

    const summaryCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You write concise, practical SEO briefings for community news journalists. Be specific and actionable. Write in plain prose, 3–5 sentences max. Focus on the actual search phrases listed — quote them directly. Do not invent phrases that are not in the data. If there are breakout or rising queries, lead with those.`,
        },
        {
          role: "user",
          content: `Write a short SEO briefing for "${page.name}" based on this Google Trends data from Ireland (past 12 months).

"Breakout" means the search term grew by more than 5000% — these are the most important trending phrases.

Breakout searches (highest priority): ${breakoutQueries || "none"}
Rising searches (with % increase): ${risingList || "none"}
Top established searches: ${topList || "none"}
Peak interest months: ${peakList || "none"}${trendsData.searchTerms.length ? `\nSearch terms tracked: ${trendsData.searchTerms.join(", ")}` : ""}

The briefing is for a journalist writing articles about ${page.name}. Tell them specifically which of the above phrases to weave into headlines and body text — use the exact phrases from the data. Explain what the trends reveal about audience intent. Do not use bullet points — write as flowing prose. Do not say "there are no rising searches" — there clearly are.`,
        },
      ],
      temperature: 0.4,
    });

    const trendsSummary = summaryCompletion.choices[0]?.message?.content?.trim() ?? "";

    // ── Merge with any existing trendsData ───────────────────────────────────
    const existing = (page.trendsData as any) ?? {};
    const merged = mergeTrendsData(existing, trendsData);

    const [updated] = await db
      .update(entityPagesTable)
      .set({ trendsData: merged, trendsSummary, updatedAt: new Date() })
      .where(eq(entityPagesTable.id, id))
      .returning();

    res.json({ trendsData: merged, trendsSummary, page: updated });
  } catch (err) {
    req.log.error(err, "Failed to upload trends data");
    res.status(500).json({ error: "Failed to upload trends data" });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchRelatedPages(entityPageId: number) {
  const rows = await db
    .select({
      id: entityPagesTable.id,
      name: entityPagesTable.name,
      slug: entityPagesTable.slug,
      entityType: entityPagesTable.entityType,
      shortDescription: entityPagesTable.shortDescription,
      photos: entityPagesTable.photos,
      relationLabel: entityPageRelationsTable.relationLabel,
    })
    .from(entityPageRelationsTable)
    .innerJoin(entityPagesTable, eq(entityPageRelationsTable.relatedEntityPageId, entityPagesTable.id))
    .where(eq(entityPageRelationsTable.entityPageId, entityPageId))
    .orderBy(entityPagesTable.name);
  return rows;
}

interface TrendsData {
  lastUploadedAt: string;
  searchTerms: string[];
  risingQueries: { query: string; changePercent: number }[];
  topQueries: string[];
  peakMonths: string[];
}

function parseTrendsCSV(raw: string): TrendsData {
  // Normalise line endings + strip BOM
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");

  const searchTerms: string[] = [];
  const risingQueries: { query: string; changePercent: number }[] = [];
  const topQueries: string[] = [];
  const monthScores: Record<string, number> = {};

  // ── Detect flat "searched with / rising queries" export format ─────────────
  // Header: "query","search interest","increase percent"
  const firstDataLine = lines.find((l) => l.trim() && !l.trim().startsWith("#"));
  const firstCols = firstDataLine ? parseCSVLine(firstDataLine.trim()) : [];
  const isFlatFormat =
    firstCols.length >= 3 &&
    firstCols[0].toLowerCase().includes("query") &&
    firstCols[1].toLowerCase().includes("search") &&
    firstCols[2].toLowerCase().includes("increase");

  if (isFlatFormat) {
    // Flat export: each row is a related query with a search interest score and change %
    let headerSkipped = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (!headerSkipped) { headerSkipped = true; continue; } // skip header row
      if (cols.length < 3) continue;

      const query = cols[0].trim();
      const changeRaw = cols[2].trim(); // "Breakout", "4,100%", "350%", "-20%"

      if (!query || query.toLowerCase() === "query") continue;

      // Parse changePercent — handle commas in numbers like "4,100%"
      const changeClean = changeRaw.replace(/,/g, "");
      const numMatch = changeClean.match(/-?\d+/);
      const changePercent = changeRaw.toLowerCase() === "breakout"
        ? 5000
        : numMatch ? parseInt(numMatch[0], 10) : 0;

      if (changePercent > 0) {
        // Positive change → rising query
        if (!risingQueries.find((r) => r.query === query)) {
          risingQueries.push({ query, changePercent });
        }
      } else if (changePercent === 0) {
        // Neutral — treat as a top established query
        if (!topQueries.includes(query)) topQueries.push(query);
      }
      // Negative change → declining, skip
    }

    risingQueries.sort((a, b) => b.changePercent - a.changePercent);

    return {
      lastUploadedAt: new Date().toISOString(),
      searchTerms,
      risingQueries: risingQueries.slice(0, 15),
      topQueries: topQueries.slice(0, 10),
      peakMonths: [],
    };
  }

  // ── Standard multi-section Google Trends export ───────────────────────────
  let section = "";
  let subsection = "";
  let headerParsed = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      subsection = "";
      headerParsed = false;
      continue;
    }

    if (line === "Interest over time") { section = "interest"; subsection = ""; headerParsed = false; continue; }
    if (line === "Related topics") { section = "topics"; subsection = ""; headerParsed = false; continue; }
    if (line === "Related queries") { section = "queries"; subsection = ""; headerParsed = false; continue; }
    if (line === "Top" && (section === "topics" || section === "queries")) { subsection = "top"; headerParsed = false; continue; }
    if (line === "Rising" && (section === "topics" || section === "queries")) { subsection = "rising"; headerParsed = false; continue; }

    const cols = parseCSVLine(line);

    if (section === "interest") {
      if (!headerParsed) {
        for (let i = 1; i < cols.length; i++) {
          const term = cols[i].replace(/:\s*\([^)]+\)/, "").trim();
          if (term && !searchTerms.includes(term)) searchTerms.push(term);
        }
        headerParsed = true;
        continue;
      }
      const dateCell = cols[0];
      const scores = cols.slice(1).map((v) => parseInt(v.replace(/[^0-9]/g, ""), 10)).filter((n) => !isNaN(n));
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const dateMatch = dateCell.match(/(\d{4}-\d{2})/);
      if (dateMatch && avg > 0) {
        const month = getMonthName(dateMatch[1]);
        monthScores[month] = (monthScores[month] ?? 0) + avg;
      }
      continue;
    }

    if (section === "queries") {
      if (!headerParsed) { headerParsed = true; continue; }
      if (cols.length < 2) continue;
      const valueRaw = cols[0].trim();
      const query = cols[1].trim();
      if (!query || query.toLowerCase() === "query") continue;

      if (subsection === "rising") {
        const numMatch = valueRaw.replace(/,/g, "").match(/\+?(\d+)/);
        const changePercent = numMatch ? parseInt(numMatch[1], 10) : 5000;
        if (query && !risingQueries.find((r) => r.query === query)) {
          risingQueries.push({ query, changePercent });
        }
      } else if (subsection === "top") {
        if (query && !topQueries.includes(query)) topQueries.push(query);
      }
    }
  }

  risingQueries.sort((a, b) => b.changePercent - a.changePercent);

  const peakMonths = Object.entries(monthScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([m]) => m);

  return {
    lastUploadedAt: new Date().toISOString(),
    searchTerms,
    risingQueries: risingQueries.slice(0, 15),
    topQueries: topQueries.slice(0, 10),
    peakMonths,
  };
}

function mergeTrendsData(existing: any, incoming: TrendsData): TrendsData {
  // Merge search terms
  const searchTerms = Array.from(new Set([...(existing.searchTerms ?? []), ...incoming.searchTerms]));

  // Merge rising queries — keep highest changePercent for each unique query
  const risingMap = new Map<string, number>();
  for (const q of [...(existing.risingQueries ?? []), ...incoming.risingQueries]) {
    const prev = risingMap.get(q.query) ?? 0;
    if (q.changePercent > prev) risingMap.set(q.query, q.changePercent);
  }
  const risingQueries = Array.from(risingMap.entries())
    .map(([query, changePercent]) => ({ query, changePercent }))
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 15);

  // Merge top queries — dedup preserving order
  const topQueries = Array.from(new Set([...(existing.topQueries ?? []), ...incoming.topQueries])).slice(0, 10);

  // Merge peak months — prefer incoming
  const peakMonths = incoming.peakMonths.length ? incoming.peakMonths : (existing.peakMonths ?? []);

  return { lastUploadedAt: new Date().toISOString(), searchTerms, risingQueries, topQueries, peakMonths };
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleString("en-IE", { month: "long" });
}

// POST /admin/entity-pages/:id/scan-relations — scan body for related entity pages
router.post("/admin/entity-pages/:id/scan-relations", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [page] = await db.select({ id: entityPagesTable.id }).from(entityPagesTable).where(eq(entityPagesTable.id, id));
    if (!page) return res.status(404).json({ error: "Entity page not found" });
    const result = await scanEntityPageRelations(id);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to scan entity page relations");
    res.status(500).json({ error: "Failed to scan entity page relations" });
  }
});

// POST /admin/entity-pages/:id/relations — manually add a relation
router.post("/admin/entity-pages/:id/relations", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { relatedEntityPageId, relationLabel } = req.body;
    if (!relatedEntityPageId || typeof relatedEntityPageId !== "number") {
      return res.status(400).json({ error: "relatedEntityPageId is required" });
    }
    if (relatedEntityPageId === id) return res.status(400).json({ error: "Cannot relate a page to itself" });

    // Insert A→B
    const existsAB = await db.select({ id: entityPageRelationsTable.id }).from(entityPageRelationsTable)
      .where(and(eq(entityPageRelationsTable.entityPageId, id), eq(entityPageRelationsTable.relatedEntityPageId, relatedEntityPageId))).limit(1);
    if (existsAB.length === 0) {
      await db.insert(entityPageRelationsTable).values({ entityPageId: id, relatedEntityPageId, relationLabel: relationLabel ?? null });
    }
    // Insert B→A
    const existsBA = await db.select({ id: entityPageRelationsTable.id }).from(entityPageRelationsTable)
      .where(and(eq(entityPageRelationsTable.entityPageId, relatedEntityPageId), eq(entityPageRelationsTable.relatedEntityPageId, id))).limit(1);
    if (existsBA.length === 0) {
      await db.insert(entityPageRelationsTable).values({ entityPageId: relatedEntityPageId, relatedEntityPageId: id, relationLabel: relationLabel ?? null });
    }

    const relatedPages = await fetchRelatedPages(id);
    res.json({ relatedPages });
  } catch (err) {
    req.log.error(err, "Failed to add entity page relation");
    res.status(500).json({ error: "Failed to add entity page relation" });
  }
});

// DELETE /admin/entity-pages/:id/relations/:relatedId — remove a relation (both directions)
router.delete("/admin/entity-pages/:id/relations/:relatedId", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const relatedId = parseInt(req.params.relatedId, 10);
    if (isNaN(id) || isNaN(relatedId)) return res.status(400).json({ error: "Invalid id" });

    await db.delete(entityPageRelationsTable).where(
      and(eq(entityPageRelationsTable.entityPageId, id), eq(entityPageRelationsTable.relatedEntityPageId, relatedId)),
    );
    await db.delete(entityPageRelationsTable).where(
      and(eq(entityPageRelationsTable.entityPageId, relatedId), eq(entityPageRelationsTable.relatedEntityPageId, id)),
    );

    const relatedPages = await fetchRelatedPages(id);
    res.json({ relatedPages });
  } catch (err) {
    req.log.error(err, "Failed to remove entity page relation");
    res.status(500).json({ error: "Failed to remove entity page relation" });
  }
});

// POST /admin/entity-pages/:id/rescan-posts — link all matching published posts
router.post("/admin/entity-pages/:id/rescan-posts", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [page] = await db.select().from(entityPagesTable).where(eq(entityPagesTable.id, id));
    if (!page) return res.status(404).json({ error: "Entity page not found" });

    // Build match terms: primary name + all aliases
    const matchTerms = [page.name, ...(page.aliases ?? [])].filter(Boolean);

    function escapeRx(str: string) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function wholeWord(text: string, term: string) {
      return new RegExp(`\\b${escapeRx(term.toLowerCase())}\\b`).test(text);
    }

    // Fetch all published posts
    const posts = await db
      .select({ id: postsTable.id, title: postsTable.title, body: postsTable.body })
      .from(postsTable)
      .where(eq(postsTable.status, "published"));

    let linked = 0;
    let skipped = 0;

    for (const post of posts) {
      const haystack = `${post.title} ${post.body}`.toLowerCase();
      const hit = matchTerms.some((term) => wholeWord(haystack, term));
      if (!hit) continue;

      // Check if already linked
      const existing = await db
        .select({ entityPageId: entityPageArticlesTable.entityPageId })
        .from(entityPageArticlesTable)
        .where(
          and(
            eq(entityPageArticlesTable.entityPageId, id),
            eq(entityPageArticlesTable.postId, post.id),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(entityPageArticlesTable).values({ entityPageId: id, postId: post.id });
        linked++;
      } else {
        skipped++;
      }
    }

    req.log.info({ entityPageId: id, linked, skipped }, "Rescan posts complete");
    res.json({ linked, skipped, total: posts.length });
  } catch (err) {
    req.log.error(err, "Failed to rescan posts");
    res.status(500).json({ error: "Failed to rescan posts" });
  }
});

// DELETE /admin/entity-pages/:id — delete
router.delete("/admin/entity-pages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(entityPagesTable)
      .where(eq(entityPagesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Entity page not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete entity page");
    res.status(500).json({ error: "Failed to delete entity page" });
  }
});

export default router;
