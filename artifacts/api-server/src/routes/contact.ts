import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable, newsletterSubscribersTable } from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { adminAuth } from "../lib/admin-auth";

const router = Router();

// ---------------------------------------------------------------------------
// Public: submit contact form
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 3;
  const hits = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxRequests) return true;
  hits.push(now);
  rateLimitMap.set(ip, hits);
  return false;
}

router.post("/public/contact", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many submissions. Please try again later." });
  }

  const { name, email, subject, message, subscribeNewsletter } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "validation_error", message: "Name, email, and message are required." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: "validation_error", message: "Please enter a valid email address." });
  }

  try {
    await db.insert(contactSubmissionsTable).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject?.trim() || null,
      message: message.trim(),
      status: "unread",
    });

    if (subscribeNewsletter === true || subscribeNewsletter === "true") {
      await db
        .insert(newsletterSubscribersTable)
        .values({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          source: "contact_form",
          status: "active",
        })
        .onConflictDoNothing();
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to submit. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Public: newsletter subscribe (footer widget)
// ---------------------------------------------------------------------------

router.post("/public/newsletter/subscribe", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests." });
  }

  const { email, name } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ error: "validation_error", message: "Email is required." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: "validation_error", message: "Please enter a valid email address." });
  }

  try {
    await db
      .insert(newsletterSubscribersTable)
      .values({
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        source: "footer_widget",
        status: "active",
      })
      .onConflictDoNothing();

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to subscribe. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Admin: list contact submissions
// ---------------------------------------------------------------------------

router.get("/contact", adminAuth, async (req, res) => {
  const statusFilter = req.query.status as string | undefined;

  try {
    const rows = await db
      .select()
      .from(contactSubmissionsTable)
      .orderBy(desc(contactSubmissionsTable.createdAt));

    const filtered = statusFilter
      ? rows.filter((r) => r.status === statusFilter)
      : rows;

    const unreadCount = rows.filter((r) => r.status === "unread").length;

    res.json({ submissions: filtered, unreadCount });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch contact submissions." });
  }
});

// ---------------------------------------------------------------------------
// Admin: update contact submission (status / notes)
// ---------------------------------------------------------------------------

router.patch("/contact/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID." });

  const { status, notes } = req.body;
  const updates: Partial<typeof contactSubmissionsTable.$inferInsert> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "validation_error", message: "Nothing to update." });
  }

  try {
    const [updated] = await db
      .update(contactSubmissionsTable)
      .set(updates)
      .where(eq(contactSubmissionsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found", message: "Submission not found." });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to update submission." });
  }
});

// ---------------------------------------------------------------------------
// Admin: list newsletter subscribers
// ---------------------------------------------------------------------------

router.get("/newsletter/subscribers", adminAuth, async (_req, res) => {
  try {
    const subscribers = await db
      .select()
      .from(newsletterSubscribersTable)
      .orderBy(desc(newsletterSubscribersTable.subscribedAt));

    const [{ total }] = await db.select({ total: count() }).from(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.status, "active"));

    res.json({ subscribers, totalActive: Number(total) });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch subscribers." });
  }
});

export default router;
