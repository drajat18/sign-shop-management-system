import { Schema, type InferSchemaType } from "mongoose";

export const STORAGE_OAUTH_PROVIDERS = ["dropbox", "google_drive"] as const;
export type StorageOAuthProvider = (typeof STORAGE_OAUTH_PROVIDERS)[number];

// One per shop per provider — a shop's Dropbox/Google Drive connection,
// not a customer's. Tokens are per-shop because the actual files land in
// whichever account an Admin connected in Settings, not in ours.
export const storageConnectionSchema = new Schema(
  {
    provider: { type: String, enum: STORAGE_OAUTH_PROVIDERS, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    // Dropbox's account_id or Google's account email — shown in Settings so
    // an Admin can tell at a glance which account is connected.
    accountLabel: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
storageConnectionSchema.index({ provider: 1 }, { unique: true });

export type StorageConnection = InferSchemaType<typeof storageConnectionSchema>;
