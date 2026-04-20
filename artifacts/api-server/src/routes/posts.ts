import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postCategoriesTable, categoriesTable, rssItemsTable, rssFeedsTable, submissionsTable, contributorsTable, aiUsageLogTable, socialCaptionsTable } from "@workspace/db/schema";
import { eq, and, desc, count, sql, ilike, sum, inArray } from "drizzle-orm";
import { sendTextMessage } from "../lib/whatsapp-client";
import { getSettingValue } from "./settings";
import { regeneratePostImage } from "../lib/ai-pipeline";
import { postToFacebookPage } from "../lib/facebook-poster";
import { generateAndStoreSocialCaptions, getSocialCaptionsForPost } from "../lib/social-caption-agent";
import { matchEntityInArticle } from "../lib/entity-matcher";
import OpenAI from "openai";

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
      .select()
      .from(postsTable)
      .where(whereClause)
      .orderBy(desc(postsTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich posts with submission source type (whatsapp vs rss) via a batched secondary query
    const submissionIds = posts.map((p) => p.sourceSubmissionId).filter((id): id is number => id !== null);
    const sourceMap: Record<number, "whatsapp" | "rss"> = {};
    if (submissionIds.length > 0) {
      const sources = await db
        .select({ id: submissionsTable.id, source: submissionsTable.source })
        .from(submissionsTable)
        .where(inArray(submissionsTable.id, submissionIds));
      for (const s of sources) sourceMap[s.id] = s.source as "whatsapp" | "rss";
    }

    const enrichedPosts = posts.map((p) => ({
      ...p,
      submissionSource: p.sourceSubmissionId ? (sourceMap[p.sourceSubmissionId] ?? null) : null,
    }));

    res.json({
      posts: enrichedPosts,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /posts] error:", err?.message, err?.stack);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch posts", detail: err?.message });
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

router.get("/posts/:id/source", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db
      .select({ sourceSubmissionId: postsTable.sourceSubmissionId })
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    if (!post.sourceSubmissionId) return res.json({ sourceRawText: null, sourceVoiceTranscript: null });

    const [submission] = await db
      .select({ rawText: submissionsTable.rawText, voiceTranscript: submissionsTable.voiceTranscript })
      .from(submissionsTable)
      .where(eq(submissionsTable.id, post.sourceSubmissionId))
      .limit(1);

    res.json({
      sourceRawText: submission?.rawText ?? null,
      sourceVoiceTranscript: submission?.voiceTranscript ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch post source" });
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

  const { title, body, excerpt, headerImageUrl, imagePrompt, status, confidenceScore, primaryCategoryId, isSponsored, isFeatured, publishedAt, starRating } = req.body;

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
    if (imagePrompt !== undefined) updates.imagePrompt = imagePrompt;
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

    // --- Auto-generate image + social captions + post to Facebook when manually published ---
    // Runs as a single sequential async task so Facebook always receives the image.
    // Image generation must complete before Facebook posting — running them concurrently
    // caused Facebook to fire before the image was ready, resulting in imageless posts.
    if (status === "published" && currentPost.status !== "published") {
      (async () => {
        try {
          // Step 1: Generate header image if one isn't already set.
          // We always generate regardless of the auto_generate_images setting so that
          // Facebook always has a real photo to attach to the link card.
          let resolvedHeaderImageUrl: string | null = post.headerImageUrl ?? null;
          if (!resolvedHeaderImageUrl && currentPost.imagePrompt) {
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
                resolvedHeaderImageUrl = generated.imageUrl;
              }
            } catch {
              // Non-fatal — image generation failure should never block Facebook posting
            }
          }

          // Step 2: Fetch category name for richer caption context
          let categoryName: string | null = null;
          if (post.primaryCategoryId) {
            const [cat] = await db
              .select({ name: categoriesTable.name })
              .from(categoriesTable)
              .where(eq(categoriesTable.id, post.primaryCategoryId));
            categoryName = cat?.name ?? null;
          }

          // Step 3: Generate and store AI social captions
          await generateAndStoreSocialCaptions({
            id: post.id,
            title: post.title,
            body: post.body,
            excerpt: post.excerpt,
            categoryName,
          });

          // Step 4: Post to Facebook with the now-resolved image
          const storedCaptions = await getSocialCaptionsForPost(post.id);
          const facebookCaption = storedCaptions?.captionFacebook ?? undefined;

          await postToFacebookPage({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            overrideMessage: facebookCaption,
            headerImageUrl: resolvedHeaderImageUrl ?? undefined,
            bodyImages: post.bodyImages,
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
            const siteUrl = (await getSettingValue("platform_url")) ?? "https://whatsuptallaght.ie";
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

router.post("/posts/:id/post-to-facebook", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });
    if (post.status !== "published") {
      return res.status(400).json({ error: "not_published", message: "Only published articles can be posted to Facebook" });
    }

    // Use stored AI caption if available, otherwise fall back to excerpt
    const storedCaptions = await getSocialCaptionsForPost(post.id);
    const facebookCaption = storedCaptions?.captionFacebook ?? undefined;

    const result = await postToFacebookPage({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      overrideMessage: facebookCaption,
      headerImageUrl: post.headerImageUrl,
      bodyImages: post.bodyImages as string[] | null,
    });

    if (!result.postId) {
      return res.status(502).json({ error: "facebook_error", message: result.errorDetail ?? "Facebook post failed" });
    }

    res.json({ success: true, facebookPostId: result.postId });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to post to Facebook" });
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

/**
 * POST /admin/posts/:id/rematch-entity
 *
 * Re-runs entity matching + centrality check on the current article body.
 * If an entity with an image is found, updates the post's headerImageUrl.
 * Useful after manually correcting a typo in the article (e.g. "Run Red" → "Rua Red").
 */
router.post("/posts/:id/rematch-entity", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [post] = await db
      .select({ id: postsTable.id, body: postsTable.body })
      .from(postsTable)
      .where(eq(postsTable.id, id));

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const match = await matchEntityInArticle(post.body, openai);

    if (!match || !match.entityImageUrl) {
      return res.status(200).json({ matched: false, message: "No central entity with an image found in this article" });
    }

    const [updated] = await db
      .update(postsTable)
      .set({ headerImageUrl: match.entityImageUrl, updatedAt: new Date() })
      .where(eq(postsTable.id, id))
      .returning();

    res.json({ matched: true, entityName: match.entityName, matchedOn: match.matchedOn, post: updated });
  } catch (err: any) {
    res.status(500).json({ error: "internal_error", message: err.message ?? "Entity rematch failed" });
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
