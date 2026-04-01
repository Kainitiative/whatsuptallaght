import { Router } from "express";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt, isEncryptionKeySet } from "../lib/encryption";

const router = Router();

// GET /admin/settings — list all settings (values masked for secrets)
router.get("/admin/settings", async (_req, res) => {
  try {
    const settings = await db
      .select()
      .from(platformSettingsTable)
      .orderBy(platformSettingsTable.displayOrder);

    const safeSettings = settings.map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      description: s.description,
      helpUrl: s.helpUrl,
      category: s.category,
      isSecret: s.isSecret,
      isRequired: s.isRequired,
      isConfigured: s.isConfigured,
      displayOrder: s.displayOrder,
      updatedAt: s.updatedAt,
      // For secrets, return masked value or null — never the real value
      value: s.isSecret
        ? s.isConfigured ? "••••••••" : null
        : s.isConfigured && s.encryptedValue
          ? decrypt(s.encryptedValue)
          : null,
    }));

    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch settings" });
  }
});

// GET /admin/settings/status — setup completion status per category
router.get("/admin/settings/status", async (_req, res) => {
  try {
    const settings = await db.select().from(platformSettingsTable);

    const categories: Record<string, { total: number; configured: number; complete: boolean }> = {};

    for (const s of settings) {
      if (!s.isRequired) continue;
      if (!categories[s.category]) {
        categories[s.category] = { total: 0, configured: 0, complete: false };
      }
      categories[s.category].total++;
      if (s.isConfigured) categories[s.category].configured++;
    }

    for (const cat of Object.values(categories)) {
      cat.complete = cat.total === cat.configured;
    }

    res.json({
      encryptionKeySet: isEncryptionKeySet(),
      categories,
      allComplete: Object.values(categories).every((c) => c.complete),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch settings status" });
  }
});

// PUT /admin/settings/:key — set a setting value
router.put("/admin/settings/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: "validation_error", message: "value is required" });
  }

  try {
    const [existing] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, key));

    if (!existing) {
      return res.status(404).json({ error: "not_found", message: `Setting '${key}' not found` });
    }

    const encryptedValue = encrypt(String(value));

    const [updated] = await db
      .update(platformSettingsTable)
      .set({
        encryptedValue,
        isConfigured: true,
        updatedAt: new Date(),
      })
      .where(eq(platformSettingsTable.key, key))
      .returning();

    res.json({
      key: updated.key,
      label: updated.label,
      isConfigured: updated.isConfigured,
      isSecret: updated.isSecret,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update setting" });
  }
});

// DELETE /admin/settings/:key — clear a setting value
router.delete("/admin/settings/:key", async (req, res) => {
  const { key } = req.params;

  try {
    const [updated] = await db
      .update(platformSettingsTable)
      .set({ encryptedValue: null, isConfigured: false, updatedAt: new Date() })
      .where(eq(platformSettingsTable.key, key))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "not_found", message: `Setting '${key}' not found` });
    }

    res.json({ key: updated.key, isConfigured: false });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to clear setting" });
  }
});

// Internal helper — used by the pipeline to read a decrypted setting value
// NOT exposed to the public; imported directly by other server modules
export async function getSettingValue(key: string): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key));

  if (!setting?.encryptedValue) return null;
  return decrypt(setting.encryptedValue);
}

export default router;
