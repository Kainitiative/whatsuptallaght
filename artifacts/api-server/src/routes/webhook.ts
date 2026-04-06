import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  submissionsTable,
  contributorsTable,
  jobQueueTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getSettingValue } from "./settings";
import { sendTextMessage } from "../lib/whatsapp-client";
import { isCommand, handleCommand } from "../lib/commands";
import { logger } from "../lib/logger";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashPhone(phoneNumber: string): string {
  return crypto.createHash("sha256").update(`tallaght:${phoneNumber}`).digest("hex");
}

async function upsertContributor(phoneHash: string, displayName: string) {
  const [existing] = await db
    .select()
    .from(contributorsTable)
    .where(eq(contributorsTable.phoneHash, phoneHash))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(contributorsTable)
    .values({
      phoneHash,
      displayName,
    })
    .returning();

  return created;
}

// ---------------------------------------------------------------------------
// GET /webhooks/whatsapp — Meta verification handshake
// ---------------------------------------------------------------------------

router.get("/webhooks/whatsapp", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode !== "subscribe") {
    return res.status(400).json({ error: "bad_mode" });
  }

  const verifyToken = await getSettingValue("whatsapp_webhook_verify_token");
  if (!verifyToken) {
    logger.warn("Webhook verification attempted but verify token is not configured");
    return res.status(503).json({ error: "not_configured" });
  }

  if (token !== verifyToken) {
    logger.warn({ received: token }, "Webhook verification failed — token mismatch");
    return res.status(403).json({ error: "invalid_token" });
  }

  logger.info("WhatsApp webhook verified");
  return res.status(200).send(challenge);
});

// ---------------------------------------------------------------------------
// POST /webhooks/whatsapp — Incoming messages
// ---------------------------------------------------------------------------

router.post("/webhooks/whatsapp", async (req: Request, res: Response) => {
  // Always return 200 immediately — Meta will retry if it doesn't get a fast response
  res.status(200).send("OK");

  try {
    // --- Signature verification ---
    const appSecret = await getSettingValue("whatsapp_app_secret");
    if (appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string | undefined;
      const rawBody: Buffer | undefined = (req as any).rawBody;

      if (rawBody && signature) {
        const expected =
          "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logger.warn("Webhook signature mismatch — ignoring message");
          return;
        }
      }
    }

    const body = req.body as WhatsAppWebhookBody;

    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const message of messages) {
          await handleIncomingMessage(message, contacts).catch((err) =>
            logger.error({ err, messageId: message.id }, "Error handling incoming message"),
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Unhandled error in webhook POST handler");
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

async function handleIncomingMessage(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[],
): Promise<void> {
  const phoneNumber = message.from;
  const phoneHash = hashPhone(phoneNumber);
  const contact = contacts.find((c) => c.wa_id === phoneNumber);
  const displayName = contact?.profile?.name ?? "Community Member";

  logger.info({ phoneNumber: phoneHash, type: message.type }, "Incoming WhatsApp message");

  // --- Upsert contributor ---
  const contributor = await upsertContributor(phoneHash, displayName);

  // --- Check if contributor is banned ---
  if (contributor.isBanned) {
    logger.warn({ phoneHash }, "Message from banned contributor — ignoring");
    return;
  }

  // --- Extract raw text (captions on photos/videos live outside message.text.body) ---
  const rawText = [
    message.text?.body,
    message.image?.caption,
    message.video?.caption,
    message.document?.caption,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  // --- STOP/HELP commands always work regardless of consent ---
  if (rawText && isCommand(rawText)) {
    await handleCommand(phoneNumber, contributor.id, rawText);
    return;
  }

  // --- Consent flow ---
  const consentStatus = contributor.consentStatus ?? "pending";

  if (consentStatus === "pending") {
    const reply = rawText.trim().toUpperCase();

    if (reply === "YES") {
      // --- Grant consent ---
      await db
        .update(contributorsTable)
        .set({ consentStatus: "consented", consentGivenAt: new Date(), phoneNumber, updatedAt: new Date() })
        .where(eq(contributorsTable.id, contributor.id));

      logger.info({ phoneHash }, "Contributor consented");

      // Re-queue any submissions held while awaiting consent
      const heldSubmissions = await db
        .select()
        .from(submissionsTable)
        .where(
          and(
            eq(submissionsTable.contributorId, contributor.id),
            eq(submissionsTable.status, "awaiting_consent"),
          ),
        );

      for (const held of heldSubmissions) {
        await db
          .update(submissionsTable)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(submissionsTable.id, held.id));

        await db.insert(jobQueueTable).values({
          jobType: "PROCESS_WHATSAPP_SUBMISSION",
          payload: { submissionId: held.id, phoneNumber, contributorId: contributor.id },
          status: "pending",
          maxAttempts: 3,
        });

        logger.info({ submissionId: held.id, phoneHash }, "Queued held submission after consent");
      }

      await sendTextMessage(
        phoneNumber,
        heldSubmissions.length > 0
          ? "✅ Thank you for agreeing to our terms! Your message is now being processed and we'll let you know when it's published."
          : "✅ Thank you! You're now registered as a contributor. Send us your next story and we'll get it published.",
      ).catch(() => {});
      return;
    }

    if (reply === "NO") {
      // --- Decline consent ---
      await db
        .update(contributorsTable)
        .set({ consentStatus: "declined", updatedAt: new Date() })
        .where(eq(contributorsTable.id, contributor.id));

      logger.info({ phoneHash }, "Contributor declined consent");

      await sendTextMessage(
        phoneNumber,
        "No problem. Your message won't be published. If you change your mind, reply YES at any time to agree to our terms and start contributing.",
      ).catch(() => {});
      return;
    }

    // --- New contributor or pending — hold submission and request consent ---
    const siteUrl = (await getSettingValue("platform_url")) ?? "https://whatsuptallaght.ie";

    const mediaIds: string[] = [];
    if (message.image?.id) mediaIds.push(message.image.id);
    if (message.audio?.id) mediaIds.push(message.audio.id);
    if (message.video?.id) mediaIds.push(message.video.id);
    if (message.document?.id) mediaIds.push(message.document.id);

    if (rawText || mediaIds.length > 0) {
      await db.insert(submissionsTable).values({
        contributorId: contributor.id,
        source: "whatsapp",
        rawText: rawText || null,
        mediaUrls: mediaIds.length > 0 ? mediaIds : null,
        status: "awaiting_consent",
      });

      logger.info({ phoneHash }, "Submission held pending consent");
    }

    await sendTextMessage(
      phoneNumber,
      `👋 Welcome to Tallaght Community!\n\nBefore we can publish your story, we need your agreement.\n\n📄 Terms of Use: ${siteUrl}/terms\n🔒 Privacy Policy: ${siteUrl}/privacy\n\n• You will not submit content that makes allegations or claims about identifiable individuals or businesses\n\nBy replying YES, you confirm that you have read and agree to our Terms of Use and Privacy Policy, and consent to your message being processed and used (anonymously) in published content.\n\nReply YES to agree and continue, or NO to decline (we will not process your submission).`,
    ).catch((err) => logger.error({ err }, "Failed to send consent request"));
    return;
  }

  if (consentStatus === "declined") {
    // Previously declined — remind them they can change their mind
    await sendTextMessage(
      phoneNumber,
      "You previously chose not to agree to our terms. Reply YES at any time if you change your mind and would like to start contributing.",
    ).catch(() => {});
    return;
  }

  // --- Consented — normal submission flow ---
  const mediaIds: string[] = [];
  if (message.image?.id) mediaIds.push(message.image.id);
  if (message.audio?.id) mediaIds.push(message.audio.id);
  if (message.video?.id) mediaIds.push(message.video.id);
  if (message.document?.id) mediaIds.push(message.document.id);

  if (!rawText && mediaIds.length === 0) {
    logger.info({ phoneHash, type: message.type }, "No processable content — skipping");
    return;
  }

  // --- Create submission ---
  const [submission] = await db
    .insert(submissionsTable)
    .values({
      contributorId: contributor.id,
      source: "whatsapp",
      rawText: rawText || null,
      mediaUrls: mediaIds.length > 0 ? mediaIds : null,
      status: "pending",
    })
    .returning();

  // --- Queue AI processing job ---
  await db.insert(jobQueueTable).values({
    jobType: "PROCESS_WHATSAPP_SUBMISSION",
    payload: { submissionId: submission.id, phoneNumber, contributorId: contributor.id },
    status: "pending",
    maxAttempts: 3,
  });

  logger.info({ submissionId: submission.id, phoneHash }, "Submission queued for AI processing");

  await sendTextMessage(
    phoneNumber,
    "👍 Got it! We're reviewing your story and will let you know when it's published. Reply HELP for more options.",
  ).catch((err) => logger.error({ err }, "Failed to send acknowledgment"));
}

// ---------------------------------------------------------------------------
// TypeScript types for the Meta webhook payload
// ---------------------------------------------------------------------------

interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata?: { display_phone_number: string; phone_number_id: string };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

interface WhatsAppContact {
  profile?: { name: string };
  wa_id: string;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contacts" | "order" | "system" | "button" | "interactive";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string };
}

export default router;
