import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { competitionsTable, competitionEntriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getSettingValue } from "./settings";
import { logger } from "../lib/logger";

const router = Router();

// ---------------------------------------------------------------------------
// GET /webhooks/facebook — Meta verification handshake
// ---------------------------------------------------------------------------

router.get("/webhooks/facebook", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode !== "subscribe") {
    return res.status(400).json({ error: "bad_mode" });
  }

  // Reuse the platform's Facebook app secret as the verify token (or a dedicated setting)
  const verifyToken = await getSettingValue("facebook_webhook_verify_token");
  if (!verifyToken) {
    logger.warn("Facebook webhook verification attempted but verify token not configured");
    return res.status(503).json({ error: "not_configured" });
  }

  if (token !== verifyToken) {
    logger.warn({ received: token }, "Facebook webhook verification failed — token mismatch");
    return res.status(403).json({ error: "invalid_token" });
  }

  logger.info("Facebook Page webhook verified");
  return res.status(200).send(challenge);
});

// ---------------------------------------------------------------------------
// POST /webhooks/facebook — Incoming Page feed events
// ---------------------------------------------------------------------------

router.post("/webhooks/facebook", async (req: Request, res: Response) => {
  // Always return 200 immediately — Meta retries if no fast response
  res.status(200).send("OK");

  try {
    // --- Signature verification ---
    const appSecret = await getSettingValue("facebook_app_secret");
    if (appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string | undefined;
      const rawBody: Buffer | undefined = (req as any).rawBody;

      if (rawBody && signature) {
        const expected =
          "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
        if (!crypto.timingSafeEqual(
          Buffer.from(expected.padEnd(signature.length, " ")),
          Buffer.from(signature.padEnd(expected.length, " ")),
        )) {
          logger.warn("Facebook webhook signature mismatch — ignoring");
          return;
        }
      }
    }

    const body = req.body as FacebookWebhookBody;
    if (body.object !== "page") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "feed") continue;

        const value = change.value;

        // We only care about new comments (not edits, likes, etc.)
        if (value.item !== "comment" || value.verb !== "add") continue;

        await handleIncomingComment(value).catch((err) =>
          logger.error({ err }, "Error handling Facebook comment"),
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Unhandled error in Facebook webhook POST handler");
  }
});

// ---------------------------------------------------------------------------
// Comment handler — store entry if post matches an active competition
// ---------------------------------------------------------------------------

async function handleIncomingComment(value: FacebookFeedCommentValue): Promise<void> {
  const { from, post_id, comment_id, message, created_time } = value;

  if (!post_id || !comment_id || !from?.id) return;

  // The post_id from the webhook is in the form "PAGE_ID_POST_ID"
  // The facebookPostId stored in competitions may be either format or just the post part
  // We match against both the full post_id and just the post portion after the underscore
  const postIdParts = post_id.split("_");
  const shortPostId = postIdParts[postIdParts.length - 1];

  // Find an active competition matching this post
  const [competition] = await db
    .select({ id: competitionsTable.id, status: competitionsTable.status })
    .from(competitionsTable)
    .where(eq(competitionsTable.status, "active"))
    .limit(50);

  // Check all active competitions (list is short — typically 0-2 at once)
  const allActive = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.status, "active"));

  const matched = allActive.find((c) =>
    c.facebookPostId === post_id ||
    c.facebookPostId === shortPostId ||
    post_id.endsWith(`_${c.facebookPostId}`),
  );

  if (!matched) {
    logger.debug({ post_id }, "Facebook comment received — no matching active competition");
    return;
  }

  // Deduplicate: skip if this exact comment is already stored
  const [existingEntry] = await db
    .select({ id: competitionEntriesTable.id })
    .from(competitionEntriesTable)
    .where(eq(competitionEntriesTable.commentId, comment_id))
    .limit(1);

  if (existingEntry) {
    logger.debug({ comment_id }, "Facebook comment already recorded — skipping duplicate");
    return;
  }

  // Also deduplicate by user — one entry per person per competition
  const [existingUserEntry] = await db
    .select({ id: competitionEntriesTable.id })
    .from(competitionEntriesTable)
    .where(
      and(
        eq(competitionEntriesTable.competitionId, matched.id),
        eq(competitionEntriesTable.facebookUserId, from.id),
      ),
    )
    .limit(1);

  if (existingUserEntry) {
    logger.info(
      { competitionId: matched.id, userId: from.id },
      "Facebook comment from user already entered — ignoring duplicate",
    );
    return;
  }

  await db.insert(competitionEntriesTable).values({
    competitionId: matched.id,
    facebookUserId: from.id,
    facebookUserName: from.name ?? "Facebook User",
    commentId: comment_id,
    commentText: message ?? null,
    enteredAt: created_time ? new Date(created_time * 1000) : new Date(),
  });

  logger.info(
    { competitionId: matched.id, userName: from.name, commentId: comment_id },
    "Competition entry recorded from Facebook comment",
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FacebookWebhookBody {
  object: string;
  entry?: Array<{
    id: string;
    time: number;
    changes?: Array<{
      field: string;
      value: FacebookFeedCommentValue | Record<string, unknown>;
    }>;
  }>;
}

interface FacebookFeedCommentValue {
  from?: { id: string; name?: string };
  post_id?: string;
  comment_id?: string;
  message?: string;
  created_time?: number;
  item?: string;
  verb?: string;
}

export default router;
