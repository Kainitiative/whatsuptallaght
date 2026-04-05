/**
 * Local disk storage adapter.
 *
 * Used on the VPS when STORAGE_TYPE=local.  Files are written to
 * LOCAL_STORAGE_PATH (defaults to /data/uploads) which should be a
 * Docker volume so they survive container restarts.
 *
 * On Replit, STORAGE_TYPE is not set so the Replit GCS sidecar is used
 * instead (see objectStorage.ts + storage.ts).
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_STORAGE_PATH = "/data/uploads";

export function isLocalStorage(): boolean {
  return process.env.STORAGE_TYPE === "local";
}

export function getLocalStoragePath(): string {
  return process.env.LOCAL_STORAGE_PATH ?? DEFAULT_STORAGE_PATH;
}

/** Resolve an objectPath like "whatsapp-images/uuid.jpg" to an absolute path on disk. */
export function resolveLocalPath(objectPath: string): string {
  return path.join(getLocalStoragePath(), objectPath.replace(/^\/+/, ""));
}

export async function localSave(objectPath: string, data: Buffer): Promise<void> {
  const full = resolveLocalPath(objectPath);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, data);
}

export async function localExists(objectPath: string): Promise<boolean> {
  try {
    await fs.promises.access(resolveLocalPath(objectPath));
    return true;
  } catch {
    return false;
  }
}

export function localCreateReadStream(objectPath: string): fs.ReadStream {
  return fs.createReadStream(resolveLocalPath(objectPath));
}

export function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}
