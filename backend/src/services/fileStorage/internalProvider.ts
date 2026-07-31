import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileStorageProvider } from "./index.js";

// Local disk storage — used automatically when no R2 credentials are
// configured (dev/local only; Render's filesystem doesn't survive a
// redeploy, so this is never appropriate in production). Swap is
// transparent to the rest of the app since it only ever talks to the
// FileStorageProvider interface.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const internalProvider: FileStorageProvider = {
  async upload(fileName, data, shopId) {
    const storedName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    // Shop-partitioned even on local disk — defense in depth, and keeps
    // the layout consistent with how the R2 provider organizes objects.
    const filePath = path.posix.join(`shop_${shopId}`, storedName);
    const fullPath = path.join(UPLOAD_DIR, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return { storageProvider: "internal", filePath, fileName };
  },
  async getDownloadUrl(_filePath, fileId) {
    // Local files aren't publicly reachable — the client has to fetch them
    // through our own authenticated route, not a direct URL.
    return `/api/files/${fileId}/raw`;
  },
  async delete(filePath, _shopId) {
    await fs.unlink(resolveUploadPath(filePath)).catch(() => undefined);
  },
};

export function resolveUploadPath(filePath: string): string {
  // filePath is always server-generated (never taken verbatim from a
  // request), but normalize and reject any attempt to escape UPLOAD_DIR
  // anyway rather than trusting that invariant forever.
  const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  return path.join(UPLOAD_DIR, safePath);
}
