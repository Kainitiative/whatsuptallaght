import { db } from "@workspace/db";
import { submissionsTable, contributorsTable } from "@workspace/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { sendTextMessage } from "./whatsapp-client";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const EXPIRY_MS = 48 * 60 * 60 * 1000;

async function expireStaleConsentRequests(): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRY_MS);

  const stale = await db
    .select({
      submissionId: submissionsTable.id,
      phoneNumber: contributorsTable.phoneNumber,
    })
    .from(submissionsTable)
    .innerJoin(contributorsTable, eq(contributorsTable.id, submissionsTable.contributorId))
    .where(
      and(
        eq(submissionsTable.status, "awaiting_consent"),
        lt(submissionsTable.updatedAt, cutoff),
        eq(contributorsTable.consentStatus, "consented"),
      ),
    );

  for (const record of stale) {
    await db
      .update(submissionsTable)
      .set({ status: "rejected", rejectionReason: "consent_request_expired_48h", updatedAt: new Date() })
      .where(eq(submissionsTable.id, record.submissionId));

    if (record.phoneNumber) {
      await sendTextMessage(
        record.phoneNumber,
        "Just following up — as we hadn't heard back in 48 hours, your story won't be published. If you'd still like to share it, feel free to send it again any time. 💜",
      ).catch(() => {});
    }

    logger.info({ submissionId: record.submissionId }, "Consent expiry: expired stale story consent request");
  }

  if (stale.length > 0) {
    logger.info({ count: stale.length }, "Consent expiry: expired stale story consent requests");
  }
}

export function startConsentExpiryScheduler(): void {
  logger.info("Consent expiry scheduler started");

  expireStaleConsentRequests().catch((err) =>
    logger.error({ err }, "Consent expiry: initial run failed"),
  );

  setInterval(() => {
    expireStaleConsentRequests().catch((err) =>
      logger.error({ err }, "Consent expiry: unhandled error"),
    );
  }, CHECK_INTERVAL_MS);
}
