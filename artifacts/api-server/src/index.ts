import app from "./app";
import { logger } from "./lib/logger";
import { seedSettings } from "./lib/seed-settings";
import { seedRssFeeds } from "./lib/seed-rss-feeds";
import { seedDemoContent } from "./lib/seed-demo-content";
import { isEncryptionKeySet } from "./lib/encryption";
import { startQueueWorker } from "./lib/queue-worker";
import { startRssScheduler } from "./lib/rss-fetcher";
import { startWeekendRoundupScheduler } from "./lib/weekend-roundup-scheduler";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@workspace/db";
import path from "path";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Run database migrations before anything else (production only)
  // Development uses drizzle-kit push instead
  if (process.env.NODE_ENV === "production") {
    const migrationsFolder = path.join(process.cwd(), "migrations");
    await migrate(db, { migrationsFolder });
    logger.info("Database migrations applied");
  }

  if (!isEncryptionKeySet()) {
    logger.warn(
      "SETTINGS_ENCRYPTION_KEY is not set. Settings are encrypted with a development fallback key — NOT safe for production. " +
      "Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "and set it as the SETTINGS_ENCRYPTION_KEY environment variable."
    );
  }

  await seedSettings();
  logger.info("Platform settings seeded");

  await seedRssFeeds();
  logger.info("RSS feeds seeded");

  await seedDemoContent();
  logger.info("Demo content seeded");

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startQueueWorker();
    startRssScheduler();
    startWeekendRoundupScheduler();
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
