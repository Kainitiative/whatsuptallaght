import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import {
  isLocalStorage,
  localSave,
  localExists,
  localCreateReadStream,
  guessContentType,
} from "../lib/localStorage";

const router: IRouter = Router();

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * POST /storage/uploads/request-url
 *
 * Returns a URL the browser can PUT a file to, plus the objectPath to store in DB.
 *
 * Local mode  (STORAGE_TYPE=local):  returns a direct-upload URL pointing to our own API.
 * Replit mode (default):             returns a GCS presigned PUT URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  try {
    const { contentType = "application/octet-stream" } = req.body ?? {};
    const uuid = randomUUID();
    const objectKey = `entity-logos/${uuid}`;

    if (isLocalStorage()) {
      const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
      const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() ?? "http";
      const uploadURL = `${proto}://${host}/api/storage/uploads/direct/${uuid}`;
      res.json({ uploadURL, objectPath: `/objects/${objectKey}` });
      return;
    }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(503).json({ error: "Object storage not configured (DEFAULT_OBJECT_STORAGE_BUCKET_ID missing)" });
      return;
    }

    const signRequest = {
      bucket_name: bucketId,
      object_name: objectKey,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
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

    const { signed_url: uploadURL } = (await signResponse.json()) as { signed_url: string };
    res.json({ uploadURL, objectPath: `/objects/${objectKey}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/uploads/direct/:uuid
 *
 * Local-storage mode only. Accepts the raw file body and saves it to disk.
 * The frontend treats this URL the same as a GCS presigned URL — just PUT the bytes.
 */
router.put("/storage/uploads/direct/:uuid", async (req: Request, res: Response) => {
  if (!isLocalStorage()) {
    res.status(404).json({ error: "Not available in Replit storage mode" });
    return;
  }

  try {
    const uuid = req.params.uuid;
    const objectPath = `entity-logos/${uuid}`;

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    await localSave(objectPath, body);
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * GET /storage/objects/*objectPath
 *
 * Serve files from local disk (local mode) or GCS (Replit mode).
 */
router.get("/storage/objects/*objectPath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.objectPath as string | string[];
    const rawPath = (Array.isArray(raw) ? raw.join("/") : raw).replace(/^\/+/, "");

    if (isLocalStorage()) {
      const exists = await localExists(rawPath);
      if (!exists) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const contentType = guessContentType(rawPath);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      localCreateReadStream(rawPath).pipe(res);
      return;
    }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(503).json({ error: "Storage not configured" });
      return;
    }

    const bucket = objectStorageClient.bucket(bucketId);

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
