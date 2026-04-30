import { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable, contributorsTable } from "@workspace/db/schema";
import { eq, desc, asc, and, or, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import { approveBusiness } from "../lib/business-pipeline";
import { getSettingValue } from "./settings";
import { adminAuth } from "../lib/admin-auth";

const router = Router();

// ---------------------------------------------------------------------------
// GET /public/businesses — list active businesses (public)
// ---------------------------------------------------------------------------

router.get("/public/businesses", async (req, res) => {
  try {
    const { category, q, featured } = req.query;

    let query = db
      .select({
        id: businessesTable.id,
        slug: businessesTable.slug,
        name: businessesTable.name,
        ownerName: businessesTable.ownerName,
        category: businessesTable.category,
        subcategory: businessesTable.subcategory,
        description: businessesTable.description,
        phone: businessesTable.phone,
        website: businessesTable.website,
        area: businessesTable.area,
        logoUrl: businessesTable.logoUrl,
        isFeatured: businessesTable.isFeatured,
        isSponsored: businessesTable.isSponsored,
        createdAt: businessesTable.createdAt,
        expiresAt: businessesTable.expiresAt,
      })
      .from(businessesTable)
      .$dynamic();

    const conditions = [eq(businessesTable.status, "active")];

    if (category && typeof category === "string") {
      conditions.push(eq(businessesTable.category, category));
    }

    if (featured === "true") {
      conditions.push(eq(businessesTable.isFeatured, true));
    }

    if (q && typeof q === "string" && q.trim()) {
      const search = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(businessesTable.name, search),
          ilike(businessesTable.description, search),
          ilike(businessesTable.category, search),
          ilike(businessesTable.subcategory, search),
          ilike(businessesTable.area, search),
        )!,
      );
    }

    const businesses = await query
      .where(and(...conditions))
      .orderBy(
        desc(businessesTable.isFeatured),
        desc(businessesTable.isSponsored),
        asc(businessesTable.name),
      );

    res.json(businesses);
  } catch (err) {
    logger.error({ err }, "Failed to fetch public businesses");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /public/businesses/:slug — single business profile (public)
// ---------------------------------------------------------------------------

router.get("/public/businesses/:slug", async (req, res) => {
  try {
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(
        and(
          eq(businessesTable.slug, req.params.slug),
          eq(businessesTable.status, "active"),
        ),
      )
      .limit(1);

    if (!business) return res.status(404).json({ error: "not_found" });
    res.json(business);
  } catch (err) {
    logger.error({ err }, "Failed to fetch business");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/businesses — list all businesses (admin)
// ---------------------------------------------------------------------------

router.get("/admin/businesses", adminAuth, async (req, res) => {
  try {
    const { status } = req.query;

    let query = db
      .select({
        id: businessesTable.id,
        slug: businessesTable.slug,
        name: businessesTable.name,
        ownerName: businessesTable.ownerName,
        category: businessesTable.category,
        subcategory: businessesTable.subcategory,
        description: businessesTable.description,
        phone: businessesTable.phone,
        email: businessesTable.email,
        website: businessesTable.website,
        address: businessesTable.address,
        area: businessesTable.area,
        logoUrl: businessesTable.logoUrl,
        facebookPostId: businessesTable.facebookPostId,
        facebookPostText: businessesTable.facebookPostText,
        status: businessesTable.status,
        isFeatured: businessesTable.isFeatured,
        isSponsored: businessesTable.isSponsored,
        sourceSubmissionId: businessesTable.sourceSubmissionId,
        contributorId: businessesTable.contributorId,
        expiresAt: businessesTable.expiresAt,
        createdAt: businessesTable.createdAt,
        updatedAt: businessesTable.updatedAt,
      })
      .from(businessesTable)
      .$dynamic();

    if (status && typeof status === "string") {
      query = query.where(eq(businessesTable.status, status as "pending_review" | "active" | "inactive" | "rejected"));
    }

    const businesses = await query.orderBy(desc(businessesTable.createdAt));
    res.json(businesses);
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin businesses");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/businesses/:id — update fields (admin)
// ---------------------------------------------------------------------------

router.patch("/admin/businesses/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const {
      name, ownerName, category, subcategory, description, phone, email,
      website, address, area, logoUrl, facebookPostText, status, isFeatured, isSponsored,
    } = req.body as Record<string, string | boolean | null | undefined>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (ownerName !== undefined) updates.ownerName = ownerName;
    if (category !== undefined) updates.category = category;
    if (subcategory !== undefined) updates.subcategory = subcategory;
    if (description !== undefined) updates.description = description;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (website !== undefined) updates.website = website;
    if (address !== undefined) updates.address = address;
    if (area !== undefined) updates.area = area;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (facebookPostText !== undefined) updates.facebookPostText = facebookPostText;
    if (status !== undefined) updates.status = status;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (isSponsored !== undefined) updates.isSponsored = isSponsored;

    const [updated] = await db
      .update(businessesTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updates as any)
      .where(eq(businessesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update business");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/businesses/:id/approve — approve + fire FB post + WhatsApp
// ---------------------------------------------------------------------------

router.post("/admin/businesses/:id/approve", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const platformUrl = (await getSettingValue("platform_url")) ?? "https://whatsuptallaght.ie";
    const result = await approveBusiness(id, platformUrl);
    if (!result.success) return res.status(404).json({ error: result.error });
    res.json({ success: true, facebookPostId: result.facebookPostId });
  } catch (err) {
    logger.error({ err }, "Failed to approve business");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/businesses/:id/reject — reject business
// ---------------------------------------------------------------------------

router.post("/admin/businesses/:id/reject", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [business] = await db
      .update(businessesTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(businessesTable.id, id))
      .returning();

    if (!business) return res.status(404).json({ error: "not_found" });

    // Optionally notify contributor
    if (business.contributorId) {
      try {
        const { sendTextMessage } = await import("../lib/whatsapp-client");
        const [contributor] = await db
          .select({ phoneHash: contributorsTable.phoneHash })
          .from(contributorsTable)
          .where(eq(contributorsTable.id, business.contributorId))
          .limit(1);

        if (contributor?.phoneHash) {
          await sendTextMessage(
            contributor.phoneHash,
            `Thanks for getting in touch with What's Up Tallaght. Unfortunately we weren't able to list "${business.name}" in the directory at this time. If you have questions, please reply to this message.`,
          ).catch(() => {});
        }
      } catch {
        // Non-fatal
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to reject business");
    res.status(500).json({ error: "internal_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/businesses/:id/feature — toggle featured flag
// ---------------------------------------------------------------------------

router.post("/admin/businesses/:id/feature", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [current] = await db
      .select({ isFeatured: businessesTable.isFeatured })
      .from(businessesTable)
      .where(eq(businessesTable.id, id))
      .limit(1);

    if (!current) return res.status(404).json({ error: "not_found" });

    const [updated] = await db
      .update(businessesTable)
      .set({ isFeatured: !current.isFeatured, updatedAt: new Date() })
      .where(eq(businessesTable.id, id))
      .returning({ isFeatured: businessesTable.isFeatured });

    res.json({ isFeatured: updated?.isFeatured });
  } catch (err) {
    logger.error({ err }, "Failed to toggle feature");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
