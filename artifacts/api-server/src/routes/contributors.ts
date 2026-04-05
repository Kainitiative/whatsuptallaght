import { Router } from "express";
import { db } from "@workspace/db";
import { contributorsTable } from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";

const router = Router();

router.get("/contributors", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;

  try {
    const [{ total }] = await db.select({ total: count() }).from(contributorsTable);

    const contributors = await db
      .select()
      .from(contributorsTable)
      .orderBy(desc(contributorsTable.firstSeenAt))
      .limit(limit)
      .offset(offset);

    res.json({
      contributors,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch contributors" });
  }
});

router.get("/contributors/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [contributor] = await db.select().from(contributorsTable).where(eq(contributorsTable.id, id));
    if (!contributor) return res.status(404).json({ error: "not_found", message: "Contributor not found" });
    res.json(contributor);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch contributor" });
  }
});

router.patch("/contributors/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  const { displayName, area, bio, profileImageUrl, isVerified, isBanned } = req.body;

  try {
    const updates: any = { updatedAt: new Date() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (area !== undefined) updates.area = area;
    if (bio !== undefined) updates.bio = bio;
    if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl;
    if (isVerified !== undefined) updates.isVerified = isVerified;
    if (isBanned !== undefined) updates.isBanned = isBanned;

    const [contributor] = await db
      .update(contributorsTable)
      .set(updates)
      .where(eq(contributorsTable.id, id))
      .returning();

    if (!contributor) return res.status(404).json({ error: "not_found", message: "Contributor not found" });
    res.json(contributor);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update contributor" });
  }
});

export default router;
