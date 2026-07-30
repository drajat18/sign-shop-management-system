import crypto from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileStorageProvider } from "./index.js";

// R2 speaks the S3 API, so the same SDK works — just pointed at
// Cloudflare's endpoint instead of AWS's. No egress fees on R2 is the
// whole reason this is the default over plain S3 for a workflow where
// design files get re-downloaded repeatedly during production.
function client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME!;

export const r2Provider: FileStorageProvider = {
  async upload(fileName, data, shopId) {
    const key = `shop_${shopId}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await client().send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: data }));
    return { storageProvider: "internal", filePath: key, fileName };
  },
  async getDownloadUrl(filePath) {
    // Self-contained signed URL — the client fetches directly from R2, no
    // proxying the file's bytes through our own server.
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET(), Key: filePath }), {
      expiresIn: 3600,
    });
  },
  async delete(filePath) {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: filePath }));
  },
};
