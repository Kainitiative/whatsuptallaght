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
  const { name, slug, color, description } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "validation_error", message: "name and slug are required" });
  }
  try {
    const [category] = await db
      .insert(categoriesTable)
      .values({ name, slug, color: color ?? "#C0392B", description: description ?? null })
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

router.put("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid id" });
  const { name, slug, color, description } = req.body;
  try {
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    const [category] = await db
      .update(categoriesTable)
      .set(updates)
      .where(eq(categoriesTable.id, id))
      .returning();
    if (!category) return res.status(404).json({ error: "not_found", message: "Category not found" });
    res.json(category);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "conflict", message: "Category name or slug already exists" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid id" });
  try {
    const [deleted] = await db
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "not_found", message: "Category not found" });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "conflict", message: "Cannot delete — articles exist in this category" });
    }
    res.status(500).json({ error: "internal_error", message: "Failed to delete category" });
  }
});

export default router;
