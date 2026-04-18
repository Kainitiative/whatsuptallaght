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

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
