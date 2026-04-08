import { Router } from "express";
import { db } from "@workspace/db";
import { competitionsTable, competitionEntriesTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ---------------------------------------------------------------------------
// GET /admin/competitions — list all competitions
// ---------------------------------------------------------------------------

router.get("/admin/competitions", async (_req, res) => {
  try {
    const competitions = await db
      .select({
        id: competitionsTable.id,
        title: competitionsTable.title,
        prize: competitionsTable.prize,
        facebookPostId: competitionsTable.facebookPostId,
        facebookPostUrl: competitionsTable.facebookPostUrl,
        status: competitionsTable.status,
        closingDate: competitionsTable.closingDate,
        winnerEntryId: competitionsTable.winnerEntryId,
        createdAt: competitionsTable.createdAt,
        updatedAt: competitionsTable.updatedAt,
        entryCount: sql<number>`(select count(*) from competition_entries where competition_id = competitions.id)::int`,
      })
      .from(competitionsTable)
      .orderBy(desc(competitionsTable.createdAt));

    res.json(competitions);
  } catch (err) {
    logger.error({ err }, "Failed to fetch competitions");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/competitions/:id — get one competition with its entries
// ---------------------------------------------------------------------------

router.get("/admin/competitions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, id))
      .limit(1);

    if (!competition) return res.status(404).json({ error: "not_found" });

    const entries = await db
      .select()
      .from(competitionEntriesTable)
      .where(eq(competitionEntriesTable.competitionId, id))
      .orderBy(desc(competitionEntriesTable.enteredAt));

    let winner = null;
    if (competition.winnerEntryId) {
      winner = entries.find((e) => e.id === competition.winnerEntryId) ?? null;
    }

    res.json({ ...competition, entries, winner });
  } catch (err) {
    logger.error({ err }, "Failed to fetch competition");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/competitions — create competition
// ---------------------------------------------------------------------------

router.post("/admin/competitions", async (req, res) => {
  const { title, prize, facebookPostId, facebookPostUrl, closingDate } = req.body as {
    title: string;
    prize: string;
    facebookPostId: string;
    facebookPostUrl?: string;
    closingDate?: string;
  };

  if (!title?.trim() || !prize?.trim() || !facebookPostId?.trim()) {
    return res.status(400).json({ error: "validation_error", message: "title, prize, and facebookPostId are required" });
  }

  try {
    const [created] = await db
      .insert(competitionsTable)
      .values({
        title: title.trim(),
        prize: prize.trim(),
        facebookPostId: facebookPostId.trim(),
        facebookPostUrl: facebookPostUrl?.trim() || null,
        closingDate: closingDate ? new Date(closingDate) : null,
        status: "active",
      })
      .returning();

    logger.info({ id: created.id, title: created.title }, "Competition created");
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "Failed to create competition");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/competitions/:id — update competition details
// ---------------------------------------------------------------------------

router.patch("/admin/competitions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  const { title, prize, facebookPostUrl, closingDate } = req.body as {
    title?: string;
    prize?: string;
    facebookPostUrl?: string | null;
    closingDate?: string | null;
  };

  try {
    const updates: Partial<typeof competitionsTable.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (prize !== undefined) updates.prize = prize.trim();
    if (facebookPostUrl !== undefined) updates.facebookPostUrl = facebookPostUrl?.trim() || null;
    if (closingDate !== undefined) updates.closingDate = closingDate ? new Date(closingDate) : null;

    const [updated] = await db
      .update(competitionsTable)
      .set(updates)
      .where(eq(competitionsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update competition");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/competitions/:id/close — close entries
// ---------------------------------------------------------------------------

router.post("/admin/competitions/:id/close", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [updated] = await db
      .update(competitionsTable)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(competitionsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found" });
    logger.info({ id }, "Competition closed");
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to close competition");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/competitions/:id/draw — pick a random winner
// ---------------------------------------------------------------------------

router.post("/admin/competitions/:id/draw", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, id))
      .limit(1);

    if (!competition) return res.status(404).json({ error: "not_found" });
    if (competition.status === "active") {
      return res.status(400).json({ error: "competition_still_active", message: "Close the competition before drawing a winner" });
    }
    if (competition.winnerEntryId) {
      return res.status(400).json({ error: "already_drawn", message: "A winner has already been drawn" });
    }

    const entries = await db
      .select()
      .from(competitionEntriesTable)
      .where(eq(competitionEntriesTable.competitionId, id));

    if (entries.length === 0) {
      return res.status(400).json({ error: "no_entries", message: "No entries to draw from" });
    }

    const winner = entries[Math.floor(Math.random() * entries.length)];

    const [updated] = await db
      .update(competitionsTable)
      .set({ winnerEntryId: winner.id, status: "drawn", updatedAt: new Date() })
      .where(eq(competitionsTable.id, id))
      .returning();

    logger.info({ id, winnerId: winner.id, winnerName: winner.facebookUserName }, "Competition winner drawn");
    res.json({ competition: updated, winner });
  } catch (err) {
    logger.error({ err }, "Failed to draw winner");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/competitions/:id
// ---------------------------------------------------------------------------

router.delete("/admin/competitions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [deleted] = await db
      .delete(competitionsTable)
      .where(eq(competitionsTable.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "not_found" });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete competition");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
