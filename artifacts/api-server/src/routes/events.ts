import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, postsTable, submissionsTable } from "@workspace/db/schema";
import { eq, gte, lte, and, asc, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { adminAuth } from "../lib/admin-auth";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekendRange(): { saturday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return {
    saturday: sat.toISOString().split("T")[0],
    sunday: sun.toISOString().split("T")[0],
  };
}

// ---------------------------------------------------------------------------
// Public — list events (filterable by status / weekend / date range)
// ---------------------------------------------------------------------------

router.get("/public/events", async (req, res) => {
  const status = String(req.query.status ?? "upcoming");
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const today = new Date().toISOString().split("T")[0];
    const conditions = [];

    if (status === "weekend") {
      const { saturday, sunday } = getWeekendRange();
      conditions.push(gte(eventsTable.eventDate, saturday));
      conditions.push(lte(eventsTable.eventDate, sunday));
      conditions.push(eq(eventsTable.status, "upcoming"));
    } else if (status === "upcoming") {
      conditions.push(gte(eventsTable.eventDate, today));
      conditions.push(eq(eventsTable.status, "upcoming"));
    } else if (status === "past") {
      conditions.push(lte(eventsTable.eventDate, today));
    } else if (status === "cancelled") {
      conditions.push(eq(eventsTable.status, "cancelled"));
    }

    if (from) conditions.push(gte(eventsTable.eventDate, from));
    if (to) conditions.push(lte(eventsTable.eventDate, to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(eventsTable)
      .where(where);

    const events = await db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        eventDate: eventsTable.eventDate,
        eventTime: eventsTable.eventTime,
        endDate: eventsTable.endDate,
        endTime: eventsTable.endTime,
        location: eventsTable.location,
        description: eventsTable.description,
        organiser: eventsTable.organiser,
        price: eventsTable.price,
        websiteUrl: eventsTable.websiteUrl,
        status: eventsTable.status,
        articleId: eventsTable.articleId,
        articleSlug: postsTable.slug,
        articleHeaderImageUrl: postsTable.headerImageUrl,
        submissionSource: submissionsTable.source,
      })
      .from(eventsTable)
      .leftJoin(postsTable, eq(eventsTable.articleId, postsTable.id))
      .leftJoin(submissionsTable, eq(postsTable.sourceSubmissionId, submissionsTable.id))
      .where(where)
      .orderBy(status === "past" ? desc(eventsTable.eventDate) : asc(eventsTable.eventDate))
      .limit(limit)
      .offset(offset);

    res.json({
      events,
      total: Number(total),
      page,
      totalPages: Math.ceil(Number(total) / limit),
      status,
      ...(status === "weekend" ? { weekendRange: getWeekendRange() } : {}),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch events" });
  }
});

// ---------------------------------------------------------------------------
// Admin — list all events
// ---------------------------------------------------------------------------

router.get("/events", adminAuth, async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const conditions = status ? [eq(eventsTable.status, status as any)] : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(eventsTable)
      .where(where);

    const events = await db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        eventDate: eventsTable.eventDate,
        eventTime: eventsTable.eventTime,
        endDate: eventsTable.endDate,
        endTime: eventsTable.endTime,
        location: eventsTable.location,
        description: eventsTable.description,
        organiser: eventsTable.organiser,
        contactInfo: eventsTable.contactInfo,
        websiteUrl: eventsTable.websiteUrl,
        price: eventsTable.price,
        status: eventsTable.status,
        articleId: eventsTable.articleId,
        articleDeleted: eventsTable.articleDeleted,
        createdAt: eventsTable.createdAt,
        updatedAt: eventsTable.updatedAt,
        articleSlug: postsTable.slug,
        articleTitle: postsTable.title,
        articleStatus: postsTable.status,
      })
      .from(eventsTable)
      .leftJoin(postsTable, eq(eventsTable.articleId, postsTable.id))
      .where(where)
      .orderBy(asc(eventsTable.eventDate))
      .limit(limit)
      .offset(offset);

    res.json({ events, total: Number(total), page, totalPages: Math.ceil(Number(total) / limit) });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch events" });
  }
});

// ---------------------------------------------------------------------------
// Admin — update event
// ---------------------------------------------------------------------------

router.put("/events/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  const { title, eventDate, eventTime, endDate, endTime, location, description, organiser, contactInfo, websiteUrl, price, status } = req.body;

  try {
    const updates: Partial<typeof eventsTable.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (eventDate !== undefined) updates.eventDate = eventDate;
    if (eventTime !== undefined) updates.eventTime = eventTime || null;
    if (endDate !== undefined) updates.endDate = endDate || null;
    if (endTime !== undefined) updates.endTime = endTime || null;
    if (location !== undefined) updates.location = location || null;
    if (description !== undefined) updates.description = description || null;
    if (organiser !== undefined) updates.organiser = organiser || null;
    if (contactInfo !== undefined) updates.contactInfo = contactInfo || null;
    if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl || null;
    if (price !== undefined) updates.price = price || null;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(eventsTable)
      .set(updates)
      .where(eq(eventsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found", message: "Event not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update event" });
  }
});

// ---------------------------------------------------------------------------
// Admin — delete event
// ---------------------------------------------------------------------------

router.delete("/events/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });

  try {
    const [deleted] = await db.delete(eventsTable).where(eq(eventsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "not_found", message: "Event not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete event" });
  }
});

export default router;
