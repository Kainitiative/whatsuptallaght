import { db } from "@workspace/db";
import { jobQueueTable } from "@workspace/db/schema";
import { eq, lte, sql, or, isNull } from "drizzle-orm";
import { processWhatsAppSubmission, processRssSubmission, type PipelinePayload, type RssPipelinePayload } from "./ai-pipeline";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 5000;
const BACKOFF_SECONDS = [60, 300, 900]; // 1 min, 5 min, 15 min

// ---------------------------------------------------------------------------
// Claim one pending job atomically using FOR UPDATE SKIP LOCKED
// ---------------------------------------------------------------------------

async function claimNextJob() {
  const now = new Date();

  const [job] = await db
    .update(jobQueueTable)
    .set({
      status: "processing",
      attempts: sql`${jobQueueTable.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      sql`id = (
        SELECT id FROM job_queue
        WHERE status = 'pending'
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
          AND attempts < max_attempts
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )`,
    )
    .returning();

  return job ?? null;
}

// ---------------------------------------------------------------------------
// Mark a job done or schedule a retry
// ---------------------------------------------------------------------------

async function markDone(jobId: number): Promise<void> {
  await db
    .update(jobQueueTable)
    .set({ status: "done", updatedAt: new Date() })
    .where(eq(jobQueueTable.id, jobId));
}

async function markFailed(jobId: number, error: unknown, currentAttempts: number, maxAttempts: number): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (currentAttempts >= maxAttempts) {
    await db
      .update(jobQueueTable)
      .set({ status: "failed", lastError: errorMessage, updatedAt: new Date() })
      .where(eq(jobQueueTable.id, jobId));
    logger.error({ jobId, error: errorMessage }, "Queue: job permanently failed");
  } else {
    const backoffSec = BACKOFF_SECONDS[currentAttempts - 1] ?? 900;
    const nextAttempt = new Date(Date.now() + backoffSec * 1000);
    await db
      .update(jobQueueTable)
      .set({
        status: "pending",
        lastError: errorMessage,
        nextAttemptAt: nextAttempt,
        updatedAt: new Date(),
      })
      .where(eq(jobQueueTable.id, jobId));
    logger.warn({ jobId, backoffSec, nextAttempt }, "Queue: job failed, scheduled retry");
  }
}

// ---------------------------------------------------------------------------
// Dispatch to the right handler
// ---------------------------------------------------------------------------

async function dispatchJob(jobType: string, payload: Record<string, unknown>): Promise<void> {
  switch (jobType) {
    case "PROCESS_WHATSAPP_SUBMISSION":
      await processWhatsAppSubmission(payload as unknown as PipelinePayload);
      break;

    case "PROCESS_RSS_SUBMISSION":
      await processRssSubmission(payload as unknown as RssPipelinePayload);
      break;

    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  try {
    let job = await claimNextJob();

    while (job) {
      logger.info({ jobId: job.id, jobType: job.jobType, attempt: job.attempts }, "Queue: processing job");

      try {
        await dispatchJob(job.jobType, job.payload);
        await markDone(job.id);
        logger.info({ jobId: job.id }, "Queue: job done");
      } catch (err) {
        logger.error({ err, jobId: job.id, jobType: job.jobType }, "Queue: job errored");
        await markFailed(job.id, err, job.attempts, job.maxAttempts);
      }

      // Immediately check for more pending jobs
      job = await claimNextJob();
    }
  } catch (err) {
    logger.error({ err }, "Queue worker: unexpected error in tick");
  } finally {
    running = false;
  }
}

export function startQueueWorker(): void {
  logger.info("Queue worker started");
  setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Queue worker: unhandled error"));
  }, POLL_INTERVAL_MS);
}
