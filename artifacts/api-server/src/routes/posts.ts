import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postCategoriesTable } from "@workspace/db/schema";
import { eq, and, desc, count, sql, ilike } from "drizzle-orm";

const router = Router();

router.get("/posts/summary", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totals] = await db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${postsTable.status} = 'published')`,
        draft: sql<number>`count(*) filter (where ${postsTable.status} = 'draft')`,
        held: sql<number>`count(*) filter (where ${postsTable.status} = 'held')`,
        todayPublished: sql<number>`count(*) filter (where ${postsTable.status} = 'published' and ${postsTable.publishedAt} >= ${today})`,
      })
      .from(postsTable);

    res.json({
      totalPublished: Number(totals.published),
      totalDraft: Number(totals.draft),
      totalHeld: Number(totals.held),
      todayPublished: Number(totals.todayPublished),
      byCategory: [],
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch summary" });
  }
});

router.get("/posts/slug/:slug", async (req, res) => {
  try {
    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.slug, req.params.slug));
    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch post" });
  }
});

router.get("/posts", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  try {
    const conditions = status ? [eq(postsTable.status, status as any)] : [];

    const [{ total }] = await db
      .select({ total: count() })
      .from(postsTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const posts = await db
      .select()
      .from(postsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(postsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch posts" });
  }
});

router.post("/posts", async (req, res) => {
  const { title, slug, body, excerpt, headerImageUrl, status, confidenceScore, wordCount, primaryCategoryId, sourceSubmissionId, isSponsored, isFeatured, categoryIds } = req.body;

  if (!title || !slug || !body) {
    return res.status(400).json({ error: "validation_error", message: "title, slug, and body are required" });
  }

  try {
    const [post] = await db
      .insert(postsTable)
      .values({
        title,
        slug,
        body,
        excerpt,
        headerImageUrl,
        status: status ?? "draft",
        confidenceScore,
        wordCount,
        primaryCategoryId,
        sourceSubmissionId,
        isSponsored: isSponsored ?? false,
        isFeatured: isFeatured ?? false,
      })
      .returning();

    if (categoryIds?.length) {
      await db.insert(postCategoriesTable).values(
        categoryIds.map((cid: number, i: number) => ({
          postId: post.id,
          categoryId: cid,
          isPrimary: i === 0,
        }))
      );
    }

    res.status(201).json(post);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "conflict", message: "A post with this slug already exists" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to create post" });
  }
});

router.get("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch post" });
  }
});

router.patch("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  const { title, body, excerpt, headerImageUrl, status, confidenceScore, primaryCategoryId, isSponsored, isFeatured, publishedAt } = req.body;

  try {
    const updates: Partial<typeof postsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (headerImageUrl !== undefined) updates.headerImageUrl = headerImageUrl;
    if (status !== undefined) updates.status = status;
    if (confidenceScore !== undefined) updates.confidenceScore = String(confidenceScore);
    if (primaryCategoryId !== undefined) updates.primaryCategoryId = primaryCategoryId;
    if (isSponsored !== undefined) updates.isSponsored = isSponsored;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (publishedAt !== undefined) updates.publishedAt = new Date(publishedAt);
    if (status === "published" && !publishedAt) updates.publishedAt = new Date();

    const [post] = await db
      .update(postsTable)
      .set(updates)
      .where(eq(postsTable.id, id))
      .returning();

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update post" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [deleted] = await db.delete(postsTable).where(eq(postsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "not_found", message: "Post not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete post" });
  }
});

export default router;
