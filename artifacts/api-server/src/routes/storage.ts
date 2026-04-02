import { Router, type IRouter, type Request, type Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();

/**
 * GET /storage/objects/*objectPath
 *
 * Serve files uploaded to GCS (e.g. WhatsApp submission images).
 * Path maps directly to the GCS object key inside the bucket.
 */
router.get("/storage/objects/*objectPath", async (req: Request, res: Response) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(503).json({ error: "Storage not configured" });
      return;
    }

    const raw = req.params.objectPath as string | string[];
    const objectPath = Array.isArray(raw) ? raw.join("/") : raw;

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string | undefined) ?? "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    file.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
