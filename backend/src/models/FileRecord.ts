import { Schema, type InferSchemaType } from "mongoose";

export const fileRecordSchema = new Schema(
  {
    storageProvider: { type: String, enum: ["internal", "dropbox", "google_drive"], required: true },
    // Internal storage: object key. Dropbox/Google Drive: file path/ID in the shop's connected account.
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    // Bytes at upload time. Only counted toward a shop's storage quota for
    // "internal" files — Dropbox/Google Drive cost the platform nothing, so
    // BYO-storage uploads still get a fileSize recorded (for the gallery's
    // per-file display) but are excluded from the quota sum.
    fileSize: { type: Number, default: 0 },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type FileRecord = InferSchemaType<typeof fileRecordSchema>;
