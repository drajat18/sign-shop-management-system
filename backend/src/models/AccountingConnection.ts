import { Schema, type InferSchemaType } from "mongoose";

export const ACCOUNTING_PROVIDERS = ["quickbooks"] as const;
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

// Mirrors PaymentConnection/StorageConnection exactly — same "shop
// authorizes us, we store the account reference" shape, same dummy
// fallback in settingsAccounting.routes.ts when real OAuth app credentials
// aren't configured. Swapping in real QuickBooks credentials later needs no
// change here.
export const accountingConnectionSchema = new Schema(
  {
    provider: { type: String, enum: ACCOUNTING_PROVIDERS, required: true },
    connectedAccountId: { type: String, required: true },
    accountLabel: String,
    accessToken: String,
    refreshToken: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
accountingConnectionSchema.index({ provider: 1 }, { unique: true });

export type AccountingConnection = InferSchemaType<typeof accountingConnectionSchema>;
