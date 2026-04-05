import { Router } from "express";
import { db } from "@workspace/db";
import { headerImageAssetsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/admin/image-assets", async (_req, res) => {
  try {
    const assets = await db
      .select()
      .from(headerImageAssetsTable)
      .orderBy(desc(headerImageAssetsTable.createdAt));
    res.json(assets);
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch image assets" });
  }
});

router.delete("/admin/image-assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid asset ID" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(headerImageAssetsTable)
      .where(eq(headerImageAssetsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Asset not found" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to delete asset" });
  }
});

export default router;
