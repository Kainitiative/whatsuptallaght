import { Router } from "express";
import { db } from "@workspace/db";
import { rssFeedsTable } from "@workspace/db/schema";

const router = Router();

router.get("/rss/feeds", async (_req, res) => {
  try {
    const feeds = await db.select().from(rssFeedsTable).orderBy(rssFeedsTable.name);
    res.json(feeds);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch RSS feeds" });
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

export default router;
