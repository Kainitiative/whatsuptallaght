import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  const { name, slug, color } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "validation_error", message: "name and slug are required" });
  }
  try {
    const [category] = await db
      .insert(categoriesTable)
      .values({ name, slug, color: color ?? "#C0392B" })
      .returning();
    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "conflict", message: "Category name or slug already exists" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to create category" });
  }
});

router.get("/categories/:slug", async (req, res) => {
  try {
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, req.params.slug));
    if (!category) return res.status(404).json({ error: "not_found", message: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch category" });
  }
});

export default router;
