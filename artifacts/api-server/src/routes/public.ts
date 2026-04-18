import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, categoriesTable, entityPagesTable, entityPageArticlesTable } from "@workspace/db/schema";
import { eq, and, sql, count, desc } from "drizzle-orm";
import { getSettingValue } from "./settings";

const router = Router();

router.get("/public/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = 10;
  const offset = (page - 1) * limit;

  if (!q || q.length < 2) {
    return res.json({ results: [], total: 0, query: q, page, totalPages: 0 });
  }

  try {
    const tsVector = sql`to_tsvector('english', coalesce(${postsTable.title}, '') || ' ' || coalesce(${postsTable.excerpt}, '') || ' ' || coalesce(${postsTable.body}, ''))`;
    const tsQuery = sql`plainto_tsquery('english', ${q})`;

    const [{ total }] = await db
      .select({ total: count() })
      .from(postsTable)
      .where(and(eq(postsTable.status, "published"), sql`${tsVector} @@ ${tsQuery}`));

    const results = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        slug: postsTable.slug,
        excerpt: postsTable.excerpt,
        headerImageUrl: postsTable.headerImageUrl,
        primaryCategoryId: postsTable.primaryCategoryId,
        publishedAt: postsTable.publishedAt,
        rank: sql<number>`ts_rank(${tsVector}, ${tsQuery})`,
      })
      .from(postsTable)
      .where(and(eq(postsTable.status, "published"), sql`${tsVector} @@ ${tsQuery}`))
      .orderBy(sql`ts_rank(${tsVector}, ${tsQuery}) desc`)
      .limit(limit)
      .offset(offset);

    res.json({
      results,
      total: Number(total),
      query: q,
      page,
      totalPages: Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Search failed" });
  }
});

// GET /public/entity-pages/:slug — public entity page by slug
router.get("/public/entity-pages/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [page] = await db
      .select()
      .from(entityPagesTable)
      .where(and(eq(entityPagesTable.slug, slug), eq(entityPagesTable.status, "published")));

    if (!page) {
      return res.status(404).json({ error: "not_found", message: "Entity page not found" });
    }

    const linkedArticles = await db
      .select({
        postId: entityPageArticlesTable.postId,
        title: postsTable.title,
        slug: postsTable.slug,
        excerpt: postsTable.excerpt,
        headerImageUrl: postsTable.headerImageUrl,
        primaryCategoryId: postsTable.primaryCategoryId,
        publishedAt: postsTable.publishedAt,
      })
      .from(entityPageArticlesTable)
      .innerJoin(postsTable, eq(entityPageArticlesTable.postId, postsTable.id))
      .where(
        and(
          eq(entityPageArticlesTable.entityPageId, page.id),
          eq(postsTable.status, "published"),
        ),
      )
      .orderBy(desc(postsTable.publishedAt))
      .limit(6);

    res.json({ ...page, linkedArticles });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch entity page" });
  }
});

router.get("/public/config", async (_req, res) => {
  try {
    const [whatsappNumber, platformName, platformUrl] = await Promise.all([
      getSettingValue("platform_whatsapp_display_number"),
      getSettingValue("platform_name"),
      getSettingValue("platform_url"),
    ]);

    res.json({
      whatsappNumber: whatsappNumber ?? null,
      platformName: platformName ?? "Tallaght Community",
      platformUrl: platformUrl ?? null,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch config" });
  }
});

export default router;
