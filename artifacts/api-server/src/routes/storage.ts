import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * Generate a presigned PUT URL so the browser can upload a file directly to
 * object storage without routing the bytes through the API server.
 *
 * POST /storage/uploads/request-url
 * Body: { name: string; size: number; contentType: string }
 * Response: { uploadURL: string; objectPath: string }
 *
 * objectPath is the GCS object key that can later be served via
 * GET /storage/objects/*objectPath (see below).
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(503).json({ error: "Object storage not configured (DEFAULT_OBJECT_STORAGE_BUCKET_ID missing)" });
      return;
    }

    const { contentType = "application/octet-stream" } = req.body ?? {};
    const objectPath = `entity-logos/${randomUUID()}`;

    const signRequest = {
      bucket_name: bucketId,
      object_name: objectPath,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    };

    const signResponse = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signRequest),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!signResponse.ok) {
      const errText = await signResponse.text();
      res.status(502).json({ error: `Failed to generate upload URL: ${errText}` });
      return;
    }

    const { signed_url: uploadURL } = await signResponse.json();
    // Prefix with /objects/ so the admin builds the serve path correctly:
    // `/api/storage` + `/objects/entity-logos/{uuid}` → GET /api/storage/objects/entity-logos/{uuid}
    res.json({ uploadURL, objectPath: `/objects/${objectPath}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*objectPath
 *
 * Serve files uploaded to GCS (e.g. WhatsApp submission images, entity logos).
 * Path maps directly to the GCS object key inside the bucket identified by
 * DEFAULT_OBJECT_STORAGE_BUCKET_ID.
 */
router.get("/storage/objects/*objectPath", async (req: Request, res: Response) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(503).json({ error: "Storage not configured" });
      return;
    }

    const raw = req.params.objectPath as string | string[];
    // Normalise: strip any leading slashes (double-slash URLs from early bug)
    const rawPath = (Array.isArray(raw) ? raw.join("/") : raw).replace(/^\/+/, "");

    const bucket = objectStorageClient.bucket(bucketId);

    // Try without leading slash first (new format), then with (old format)
    let file = bucket.file(rawPath);
    let [exists] = await file.exists();
    if (!exists) {
      file = bucket.file("/" + rawPath);
      [exists] = await file.exists();
    }
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
