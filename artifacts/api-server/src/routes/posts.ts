import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postCategoriesTable, categoriesTable, rssItemsTable, rssFeedsTable, submissionsTable, contributorsTable, aiUsageLogTable, socialCaptionsTable } from "@workspace/db/schema";
import { eq, and, desc, count, sql, ilike, sum } from "drizzle-orm";
import { sendTextMessage } from "../lib/whatsapp-client";
import { getSettingValue } from "./settings";
import { regeneratePostImage } from "../lib/ai-pipeline";
import { postToFacebookPage } from "../lib/facebook-poster";
import { generateAndStoreSocialCaptions, getSocialCaptionsForPost } from "../lib/social-caption-agent";

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
  const categorySlug = req.query.categorySlug as string | undefined;
  const featured = req.query.featured === "true";

  try {
    const conditions: ReturnType<typeof eq>[] = [];
    if (status) conditions.push(eq(postsTable.status, status as any));
    if (featured) conditions.push(eq(postsTable.isFeatured, true));

    if (categorySlug) {
      const [cat] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.slug, categorySlug))
        .limit(1);
      if (!cat) {
        return res.json({ posts: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      conditions.push(eq(postsTable.primaryCategoryId, cat.id));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(postsTable)
      .where(whereClause);

    const posts = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        slug: postsTable.slug,
        body: postsTable.body,
        excerpt: postsTable.excerpt,
        headerImageUrl: postsTable.headerImageUrl,
        status: postsTable.status,
        confidenceScore: postsTable.confidenceScore,
        wordCount: postsTable.wordCount,
        primaryCategoryId: postsTable.primaryCategoryId,
        sourceSubmissionId: postsTable.sourceSubmissionId,
        isSponsored: postsTable.isSponsored,
        isFeatured: postsTable.isFeatured,
        starRating: postsTable.starRating,
        publishedAt: postsTable.publishedAt,
        createdAt: postsTable.createdAt,
        updatedAt: postsTable.updatedAt,
        sourceName: rssFeedsTable.name,
      })
      .from(postsTable)
      .leftJoin(rssItemsTable, eq(rssItemsTable.postId, postsTable.id))
      .leftJoin(rssFeedsTable, eq(rssFeedsTable.id, rssItemsTable.feedId))
      .where(whereClause)
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

  const { title, body, excerpt, headerImageUrl, status, confidenceScore, primaryCategoryId, isSponsored, isFeatured, publishedAt, starRating } = req.body;

  try {
    const [currentPost] = await db
      .select({
        status: postsTable.status,
        sourceSubmissionId: postsTable.sourceSubmissionId,
        headerImageUrl: postsTable.headerImageUrl,
        imagePrompt: postsTable.imagePrompt,
      })
      .from(postsTable)
      .where(eq(postsTable.id, id));
    if (!currentPost) return res.status(404).json({ error: "not_found", message: "Post not found" });

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
    if (starRating !== undefined) updates.starRating = starRating === null ? null : Number(starRating);

    const [post] = await db
      .update(postsTable)
      .set(updates)
      .where(eq(postsTable.id, id))
      .returning();

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    res.json(post);

    // --- Auto-generate header image when a held article is published ---
    // The pipeline saves the prompt but skips DALL·E for held articles to avoid wasted spend.
    // Now that the admin has approved it, generate the image if one isn't already set.
    if (
      status === "published" &&
      currentPost.status !== "published" &&
      !currentPost.headerImageUrl &&
      currentPost.imagePrompt
    ) {
      getSettingValue("auto_generate_images").then(async (autoGenerate) => {
        if (autoGenerate !== "true") return;
        try {
          const keyFacts = post.body.split(". ").slice(0, 3).map((s: string) => s.trim()).filter(Boolean);
          const generated = await regeneratePostImage(
            post.id,
            post.title,
            keyFacts,
            "news",
            post.sourceSubmissionId ?? post.id,
          );
          if (generated) {
            await db
              .update(postsTable)
              .set({ headerImageUrl: generated.imageUrl, imagePrompt: generated.imagePrompt, updatedAt: new Date() })
              .where(eq(postsTable.id, post.id));
          }
        } catch (err) {
          // Non-fatal — image generation failure should never block publish
        }
      }).catch(() => {});
    }

    // --- Generate social captions + post to Facebook when manually published ---
    if (status === "published" && currentPost.status !== "published") {
      (async () => {
        try {
          // Fetch category name for richer caption context
          let categoryName: string | null = null;
          if (post.primaryCategoryId) {
            const [cat] = await db
              .select({ name: categoriesTable.name })
              .from(categoriesTable)
              .where(eq(categoriesTable.id, post.primaryCategoryId));
            categoryName = cat?.name ?? null;
          }

          // Generate and store AI social captions
          await generateAndStoreSocialCaptions({
            id: post.id,
            title: post.title,
            body: post.body,
            excerpt: post.excerpt,
            categoryName,
          });

          // Use the stored AI caption for Facebook — fall back to excerpt
          const storedCaptions = await getSocialCaptionsForPost(post.id);
          const facebookCaption = storedCaptions?.captionFacebook ?? undefined;

          await postToFacebookPage({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            overrideMessage: facebookCaption,
          });
        } catch {
          // Non-fatal — never block the response
        }
      })();
    }

    // --- Notify contributor when manually published ---
    if (status === "published" && currentPost.status !== "published" && currentPost.sourceSubmissionId) {
      try {
        const [submission] = await db
          .select({ contributorId: submissionsTable.contributorId })
          .from(submissionsTable)
          .where(eq(submissionsTable.id, currentPost.sourceSubmissionId));

        if (submission?.contributorId) {
          const [contributor] = await db
            .select({ phoneNumber: contributorsTable.phoneNumber })
            .from(contributorsTable)
            .where(eq(contributorsTable.id, submission.contributorId));

          if (contributor?.phoneNumber) {
            const siteUrl = (await getSettingValue("site_url")) ?? "https://tallaghtcommunity.ie";
            const articleUrl = `${siteUrl}/article/${post.slug}`;
            await sendTextMessage(
              contributor.phoneNumber,
              `✅ Your story is live on Tallaght Community!\n\n"${post.title}"\n\n🔗 ${articleUrl}\n\nFeel free to share it with friends and family! 🏘️`,
            ).catch(() => {});
          }
        }
      } catch {
      }
    }
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update post" });
  }
});

router.get("/posts/:id/cost", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db
      .select({ sourceSubmissionId: postsTable.sourceSubmissionId })
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

    if (!post.sourceSubmissionId) {
      return res.json({ hasData: false, totalCostUsd: "0.000000", stages: [] });
    }

    const usage = await db
      .select()
      .from(aiUsageLogTable)
      .where(eq(aiUsageLogTable.submissionId, post.sourceSubmissionId))
      .orderBy(aiUsageLogTable.createdAt);

    if (usage.length === 0) {
      return res.json({ hasData: false, totalCostUsd: "0.000000", stages: [] });
    }

    const totalCost = usage.reduce((sum, r) => sum + parseFloat(r.estimatedCostUsd), 0);

    return res.json({
      hasData: true,
      totalCostUsd: totalCost.toFixed(6),
      stages: usage.map((r) => ({
        stage: r.stage,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.estimatedCostUsd,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch cost data" });
  }
});

router.post("/posts/:id/regenerate-image", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

    const keyFacts = post.body
      .split(". ")
      .slice(0, 3)
      .map((s) => s.trim())
      .filter(Boolean);

    const generated = await regeneratePostImage(
      id,
      post.title,
      keyFacts,
      "news",
      post.sourceSubmissionId ?? id,
    );

    if (!generated) {
      return res.status(500).json({ error: "generation_failed", message: "Image generation failed — check OpenAI key and object storage config" });
    }

    const [updated] = await db
      .update(postsTable)
      .set({ headerImageUrl: generated.imageUrl, imagePrompt: generated.imagePrompt, updatedAt: new Date() })
      .where(eq(postsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "internal_error", message: err.message ?? "Failed to regenerate image" });
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
