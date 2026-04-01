import { Router } from "express";
import { db } from "@workspace/db";
import { adminUsersTable, adminInvitationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.get("/admin/users", async (_req, res) => {
  try {
    const users = await db.select().from(adminUsersTable).orderBy(adminUsersTable.createdAt);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch admin users" });
  }
});

router.post("/admin/invitations", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "validation_error", message: "email is required" });
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await db
      .insert(adminInvitationsTable)
      .values({ email, token, expiresAt })
      .returning();

    res.status(201).json(invitation);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to create invitation" });
  }
});

router.post("/admin/login", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "validation_error", message: "token is required" });
  }

  try {
    const [invitation] = await db
      .select()
      .from(adminInvitationsTable)
      .where(eq(adminInvitationsTable.token, token));

    if (!invitation) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
    }

    if (invitation.usedAt) {
      return res.status(401).json({ error: "unauthorized", message: "Token already used" });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(401).json({ error: "unauthorized", message: "Token expired" });
    }

    let [adminUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, invitation.email));

    if (!adminUser) {
      [adminUser] = await db
        .insert(adminUsersTable)
        .values({ email: invitation.email, name: invitation.email })
        .returning();
    }

    await db
      .update(adminInvitationsTable)
      .set({ usedAt: new Date() })
      .where(eq(adminInvitationsTable.id, invitation.id));

    await db
      .update(adminUsersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsersTable.id, adminUser.id));

    const sessionToken = crypto.randomBytes(32).toString("hex");

    res.json({ adminUser, sessionToken });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

export default router;
