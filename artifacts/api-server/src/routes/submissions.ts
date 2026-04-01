import { Router } from "express";
import { db } from "@workspace/db";
import { submissionsTable } from "@workspace/db/schema";
import { eq, desc, count, and } from "drizzle-orm";

const router = Router();

router.get("/submissions", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const source = req.query.source as string | undefined;

  try {
    const conditions: any[] = [];
    if (status) conditions.push(eq(submissionsTable.status, status as any));
    if (source) conditions.push(eq(submissionsTable.source, source as any));

    const [{ total }] = await db
      .select({ total: count() })
      .from(submissionsTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const submissions = await db
      .select()
      .from(submissionsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(submissionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      submissions,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch submissions" });
  }
});

router.post("/submissions", async (req, res) => {
  const { contributorId, source, rawText, mediaUrls, voiceTranscript, rssItemId } = req.body;

  if (!source) {
    return res.status(400).json({ error: "validation_error", message: "source is required" });
  }

  try {
    const [submission] = await db
      .insert(submissionsTable)
      .values({
        contributorId,
        source,
        rawText,
        mediaUrls,
        voiceTranscript,
        rssItemId,
        status: "pending",
      })
      .returning();
    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to create submission" });
  }
});

router.get("/submissions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
    if (!submission) return res.status(404).json({ error: "not_found", message: "Submission not found" });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch submission" });
  }
});

router.patch("/submissions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  const { status, rejectionReason } = req.body;

  try {
    const updates: any = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (rejectionReason !== undefined) updates.rejectionReason = rejectionReason;

    const [submission] = await db
      .update(submissionsTable)
      .set(updates)
      .where(eq(submissionsTable.id, id))
      .returning();

    if (!submission) return res.status(404).json({ error: "not_found", message: "Submission not found" });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update submission" });
  }
});

export default router;
