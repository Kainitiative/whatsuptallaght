import { Router } from "express";
import { getSettingValue } from "./settings";

const router = Router();

router.get("/public/config", async (_req, res) => {
  try {
    const [whatsappNumber, platformName, platformUrl] = await Promise.all([
      getSettingValue("platform_whatsapp_display_number"),
      getSettingValue("platform_name"),
      getSettingValue("platform_url"),
    ]);

    res.json({
      whatsappNumber: whatsappNumber ?? null,
      platformName: platformName ?? "Tallaght Community",
      platformUrl: platformUrl ?? null,
    });
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to fetch config" });
  }
});

export default router;
