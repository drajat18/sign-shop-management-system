import { Schema, type InferSchemaType } from "mongoose";

export const fileRecordSchema = new Schema(
  {
    storageProvider: { type: String, enum: ["internal", "dropbox"], required: true },
    // Internal storage: object key. Dropbox: file path in the shop's connected account.
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type FileRecord = InferSchemaType<typeof fileRecordSchema>;
