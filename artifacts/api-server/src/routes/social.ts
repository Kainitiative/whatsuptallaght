import { Router } from "express";
import { db } from "@workspace/db";
import { socialCaptionsTable, postsTable, categoriesTable } from "@workspace/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { generateAndStoreSocialCaptions, generateSocialCaptions } from "../lib/social-caption-agent";
import { postToFacebookPage } from "../lib/facebook-poster";

const router = Router();

// GET /admin/social/captions — list all captions joined with post info
router.get("/admin/social/captions", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: socialCaptionsTable.id,
        postId: socialCaptionsTable.postId,
        postTitle: postsTable.title,
        postSlug: postsTable.slug,
        postExcerpt: postsTable.excerpt,
        postPublishedAt: postsTable.publishedAt,
        captionFacebook: socialCaptionsTable.captionFacebook,
        captionInstagram: socialCaptionsTable.captionInstagram,
        captionTwitter: socialCaptionsTable.captionTwitter,
        hashtags: socialCaptionsTable.hashtags,
        socialScore: socialCaptionsTable.socialScore,
        recommendedSlot: socialCaptionsTable.recommendedSlot,
        isSocialWorthy: socialCaptionsTable.isSocialWorthy,
        status: socialCaptionsTable.status,
        generatedAt: socialCaptionsTable.generatedAt,
        updatedAt: socialCaptionsTable.updatedAt,
      })
      .from(socialCaptionsTable)
      .innerJoin(postsTable, eq(postsTable.id, socialCaptionsTable.postId))
      .orderBy(desc(socialCaptionsTable.generatedAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch social captions" });
  }
});

// GET /admin/social/captions/:postId — get captions for a specific post
router.get("/admin/social/captions/:postId", async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (isNaN(postId)) return res.status(400).json({ error: "validation_error", message: "Invalid post ID" });

  try {
    const [row] = await db
      .select()
      .from(socialCaptionsTable)
      .where(eq(socialCaptionsTable.postId, postId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "not_found", message: "No captions found for this post" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch captions" });
  }
});

// PUT /admin/social/captions/:id — update captions (edit)
router.put("/admin/social/captions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  const { captionFacebook, captionInstagram, captionTwitter, hashtags, status } = req.body;

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (captionFacebook !== undefined) updates.captionFacebook = captionFacebook;
    if (captionInstagram !== undefined) updates.captionInstagram = captionInstagram;
    if (captionTwitter !== undefined) updates.captionTwitter = captionTwitter;
    if (hashtags !== undefined) updates.hashtags = hashtags;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(socialCaptionsTable)
      .set(updates as any)
      .where(eq(socialCaptionsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found", message: "Caption not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update captions" });
  }
});

// POST /admin/social/captions/:postId/regenerate — re-run AI caption for a post
router.post("/admin/social/captions/:postId/regenerate", async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (isNaN(postId)) return res.status(400).json({ error: "validation_error", message: "Invalid post ID" });

  try {
    const [post] = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        body: postsTable.body,
        excerpt: postsTable.excerpt,
        primaryCategoryId: postsTable.primaryCategoryId,
      })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

    let categoryName: string | null = null;
    if (post.primaryCategoryId) {
      const [cat] = await db
        .select({ name: categoriesTable.name })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, post.primaryCategoryId));
      categoryName = cat?.name ?? null;
    }

    const captions = await generateSocialCaptions({
      id: post.id,
      title: post.title,
      body: post.body,
      excerpt: post.excerpt,
      categoryName,
    });

    if (!captions) {
      return res.status(500).json({ error: "generation_failed", message: "Caption generation failed" });
    }

    // Upsert — update existing or insert new
    const [existing] = await db
      .select({ id: socialCaptionsTable.id })
      .from(socialCaptionsTable)
      .where(eq(socialCaptionsTable.postId, postId))
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(socialCaptionsTable)
        .set({
          captionFacebook: captions.captionFacebook,
          captionInstagram: captions.captionInstagram,
          captionTwitter: captions.captionTwitter,
          hashtags: captions.hashtags,
          socialScore: captions.socialScore,
          recommendedSlot: captions.recommendedSlot,
          isSocialWorthy: captions.isSocialWorthy,
          status: "draft",
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialCaptionsTable.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(socialCaptionsTable)
        .values({
          postId,
          ...captions,
          status: "draft",
        })
        .returning();
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to regenerate captions" });
  }
});

// POST /admin/social/captions/:postId/post-facebook — post the stored caption to Facebook now
router.post("/admin/social/captions/:postId/post-facebook", async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (isNaN(postId)) return res.status(400).json({ error: "validation_error", message: "Invalid post ID" });

  try {
    const [post] = await db
      .select({ title: postsTable.title, slug: postsTable.slug, excerpt: postsTable.excerpt })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return res.status(404).json({ error: "not_found", message: "Post not found" });

    const [captions] = await db
      .select()
      .from(socialCaptionsTable)
      .where(eq(socialCaptionsTable.postId, postId))
      .limit(1);

    const facebookPostId = await postToFacebookPage({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      overrideMessage: captions?.captionFacebook ?? undefined,
    });

    if (!facebookPostId) {
      return res.status(500).json({ error: "post_failed", message: "Facebook posting failed — check server logs" });
    }

    // Mark as posted
    if (captions) {
      await db
        .update(socialCaptionsTable)
        .set({ status: "posted", updatedAt: new Date() })
        .where(eq(socialCaptionsTable.postId, postId));
    }

    res.json({ success: true, facebookPostId });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to post to Facebook" });
  }
});

export default router;
