import app from "./app";
import { logger } from "./lib/logger";
import { seedSettings } from "./lib/seed-settings";
import { seedRssFeeds } from "./lib/seed-rss-feeds";
import { seedDemoContent } from "./lib/seed-demo-content";
import { isEncryptionKeySet } from "./lib/encryption";
import { startQueueWorker } from "./lib/queue-worker";

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
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
