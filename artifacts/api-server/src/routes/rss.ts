import { Router } from "express";
import { db } from "@workspace/db";
import { rssFeedsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/rss/feeds", async (_req, res) => {
  try {
    const feeds = await db.select().from(rssFeedsTable).orderBy(rssFeedsTable.name);
    res.json(feeds);
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch RSS feeds" });
  }
});

router.get("/rss/feeds/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid feed ID" });

  try {
    const [feed] = await db.select().from(rssFeedsTable).where(eq(rssFeedsTable.id, id));
    if (!feed) return res.status(404).json({ error: "not_found", message: "Feed not found" });
    res.json(feed);
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch feed" });
  }
});

router.post("/rss/feeds", async (req, res) => {
  const { name, url, checkIntervalMinutes } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: "validation_error", message: "name and url are required" });
  }

  try {
    const [feed] = await db
      .insert(rssFeedsTable)
      .values({ name, url, checkIntervalMinutes: checkIntervalMinutes ?? 60 })
      .returning();
    res.status(201).json(feed);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "conflict", message: "A feed with this URL already exists" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to create RSS feed" });
  }
});

router.patch("/rss/feeds/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid feed ID" });

  const { name, url, isActive, checkIntervalMinutes } = req.body;
  const updates: Partial<typeof rssFeedsTable.$inferInsert> = {};

  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (isActive !== undefined) updates.isActive = isActive;
  if (checkIntervalMinutes !== undefined) updates.checkIntervalMinutes = checkIntervalMinutes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "validation_error", message: "No valid fields provided to update" });
  }

  try {
    const [updated] = await db
      .update(rssFeedsTable)
      .set(updates)
      .where(eq(rssFeedsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "not_found", message: "Feed not found" });
    res.json(updated);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "conflict", message: "A feed with this URL already exists" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to update feed" });
  }
});

router.delete("/rss/feeds/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid feed ID" });

  try {
    const [deleted] = await db
      .delete(rssFeedsTable)
      .where(eq(rssFeedsTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "not_found", message: "Feed not found" });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to delete feed" });
  }
});

export default router;
