import { Router } from "express";
import { db } from "@workspace/db";
import {
  entityPagesTable,
  entityPageArticlesTable,
  insertEntityPageSchema,
  postsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import OpenAI from "openai";
import { getSettingValue } from "./settings";

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

    res.json({ ...page, linkedArticles });
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

    const systemPrompt = `You are a local content writer for What's Up Tallaght, a community news platform serving Tallaght, Dublin. Write warm, informative, SEO-friendly content about local places, clubs, and businesses. Write in third person. Be accurate, factual, and community-focused. Do not invent facts not provided.`;

    const userPrompt = `Write a 450–550 word page about "${page.name}", a ${typeLabel[page.entityType] ?? page.entityType} in Tallaght, Dublin.

Known facts:
${contextLines.join("\n")}

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

    const risingList = trendsData.risingQueries
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
          content: `You write concise, practical SEO briefings for community news journalists. Be specific and actionable. Write in plain prose, 3–5 sentences max. Focus on what phrases people are actually searching and when interest peaks.`,
        },
        {
          role: "user",
          content: `Write a short SEO briefing for "${page.name}" based on this Google Trends data (Ireland, past 12 months):

Rising searches: ${risingList || "none"}
Top established searches: ${topList || "none"}
Peak interest months: ${peakList || "none"}
Search terms tracked: ${trendsData.searchTerms.join(", ")}

The briefing is for a journalist who will write articles about ${page.name}. Explain which phrases to include naturally in headlines and article text, and when interest peaks. Do not use bullet points — write as flowing prose.`,
        },
      ],
      temperature: 0.5,
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

  // Month → interest score (for peak month detection)
  const monthScores: Record<string, number> = {};

  let section = "";
  let subsection = "";
  let headerParsed = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      // Blank line resets subsection but not section
      subsection = "";
      headerParsed = false;
      continue;
    }

    // Section headings (no commas, not data)
    if (line === "Interest over time") { section = "interest"; subsection = ""; headerParsed = false; continue; }
    if (line === "Related topics") { section = "topics"; subsection = ""; headerParsed = false; continue; }
    if (line === "Related queries") { section = "queries"; subsection = ""; headerParsed = false; continue; }
    if (line === "Top" && (section === "topics" || section === "queries")) { subsection = "top"; headerParsed = false; continue; }
    if (line === "Rising" && (section === "topics" || section === "queries")) { subsection = "rising"; headerParsed = false; continue; }

    const cols = parseCSVLine(line);

    if (section === "interest") {
      if (!headerParsed) {
        // Header row: "Week","term1: (Country)","term2: (Country)"
        for (let i = 1; i < cols.length; i++) {
          const term = cols[i].replace(/:\s*\([^)]+\)/, "").trim();
          if (term && !searchTerms.includes(term)) searchTerms.push(term);
        }
        headerParsed = true;
        continue;
      }
      // Data rows: date range + scores
      const dateCell = cols[0]; // "2025-04-13 - 2025-04-19"
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
      if (!headerParsed) { headerParsed = true; continue; } // skip "Value,Query" header
      if (cols.length < 2) continue;
      const valueRaw = cols[0].trim();
      const query = cols[1].trim();
      if (!query || query.toLowerCase() === "query") continue;

      if (subsection === "rising") {
        // Value is like "+400%" or "Breakout"
        const numMatch = valueRaw.match(/\+?(\d+)/);
        const changePercent = numMatch ? parseInt(numMatch[1], 10) : 5000; // "Breakout" → treat as very high
        if (query && !risingQueries.find((r) => r.query === query)) {
          risingQueries.push({ query, changePercent });
        }
      } else if (subsection === "top") {
        if (query && !topQueries.includes(query)) topQueries.push(query);
      }
    }
  }

  // Sort rising by changePercent desc
  risingQueries.sort((a, b) => b.changePercent - a.changePercent);

  // Peak months: top 4 by accumulated score
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
