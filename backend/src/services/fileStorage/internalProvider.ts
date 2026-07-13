import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileStorageProvider } from "./index.js";

// Local disk storage so the app works out of the box in dev without S3/R2
// credentials. Swap this out for an @aws-sdk/client-s3 implementation when
// deploying — FileStorageProvider is the seam the rest of the app depends on.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const internalProvider: FileStorageProvider = {
  async upload(fileName, data) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), data);
    return { storageProvider: "internal", filePath: storedName, fileName };
  },
  async getDownloadUrl(filePath) {
    return path.join(UPLOAD_DIR, filePath);
  },
  async delete(filePath) {
    await fs.unlink(path.join(UPLOAD_DIR, filePath)).catch(() => undefined);
  },
};

export function resolveUploadPath(filePath: string): string {
  return path.join(UPLOAD_DIR, path.basename(filePath));
}
