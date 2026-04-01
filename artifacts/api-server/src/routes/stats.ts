import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, submissionsTable, contributorsTable, jobQueueTable } from "@workspace/db/schema";
import { count, sql } from "drizzle-orm";

const router = Router();

router.get("/stats/summary", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [postStats] = await db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${postsTable.status} = 'published')`,
        draft: sql<number>`count(*) filter (where ${postsTable.status} = 'draft')`,
        held: sql<number>`count(*) filter (where ${postsTable.status} = 'held')`,
        todayPublished: sql<number>`count(*) filter (where ${postsTable.status} = 'published' and ${postsTable.publishedAt} >= ${today})`,
      })
      .from(postsTable);

    const [submissionStats] = await db
      .select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${submissionsTable.status} = 'pending')`,
        processed: sql<number>`count(*) filter (where ${submissionsTable.status} = 'processed')`,
        rejected: sql<number>`count(*) filter (where ${submissionsTable.status} = 'rejected')`,
      })
      .from(submissionsTable);

    const [contributorStats] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${contributorsTable.isBanned} = false)`,
      })
      .from(contributorsTable);

    const [queueStats] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${jobQueueTable.status} = 'pending')`,
        failed: sql<number>`count(*) filter (where ${jobQueueTable.status} = 'failed')`,
      })
      .from(jobQueueTable);

    res.json({
      posts: {
        total: Number(postStats.total),
        published: Number(postStats.published),
        draft: Number(postStats.draft),
        held: Number(postStats.held),
        todayPublished: Number(postStats.todayPublished),
      },
      submissions: {
        total: Number(submissionStats.total),
        pending: Number(submissionStats.pending),
        processed: Number(submissionStats.processed),
        rejected: Number(submissionStats.rejected),
      },
      contributors: {
        total: Number(contributorStats.total),
        active: Number(contributorStats.active),
      },
      queue: {
        pending: Number(queueStats.pending),
        failed: Number(queueStats.failed),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch stats" });
  }
});

export default router;
