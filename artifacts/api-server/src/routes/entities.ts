import { Router } from "express";
import { db } from "@workspace/db";
import { entitiesTable, insertEntitySchema } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";

const router = Router();

// GET /admin/entities/search?q=... — MUST be before /:id to avoid path collision
router.get("/admin/entities/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const entities = await db
      .select()
      .from(entitiesTable)
      .where(ilike(entitiesTable.name, `%${q}%`))
      .limit(10);
    res.json(entities);
  } catch (err) {
    req.log.error(err, "Failed to search entities");
    res.status(500).json({ error: "Failed to search entities" });
  }
});

// GET /admin/entities — list all entities
router.get("/admin/entities", async (req, res) => {
  try {
    const entities = await db
      .select()
      .from(entitiesTable)
      .orderBy(entitiesTable.name);
    res.json(entities);
  } catch (err) {
    req.log.error(err, "Failed to list entities");
    res.status(500).json({ error: "Failed to list entities" });
  }
});

// GET /admin/entities/:id — get single entity
router.get("/admin/entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [entity] = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, id));
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  } catch (err) {
    req.log.error(err, "Failed to get entity");
    res.status(500).json({ error: "Failed to get entity" });
  }
});

// POST /admin/entities — create entity
router.post("/admin/entities", async (req, res) => {
  try {
    const body = insertEntitySchema.parse(req.body);
    const [entity] = await db
      .insert(entitiesTable)
      .values(body)
      .returning();
    res.status(201).json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    req.log.error(err, "Failed to create entity");
    res.status(500).json({ error: "Failed to create entity" });
  }
});

// PUT /admin/entities/:id — update entity
router.put("/admin/entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const body = insertEntitySchema.partial().parse(req.body);
    const [entity] = await db
      .update(entitiesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(entitiesTable.id, id))
      .returning();
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    req.log.error(err, "Failed to update entity");
    res.status(500).json({ error: "Failed to update entity" });
  }
});

// DELETE /admin/entities/:id — delete entity
router.delete("/admin/entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(entitiesTable)
      .where(eq(entitiesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Entity not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete entity");
    res.status(500).json({ error: "Failed to delete entity" });
  }
});

export default router;
