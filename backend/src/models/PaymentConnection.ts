import { Schema, type InferSchemaType } from "mongoose";

export const PAYMENT_OAUTH_PROVIDERS = ["stripe"] as const;
export type PaymentOAuthProvider = (typeof PAYMENT_OAUTH_PROVIDERS)[number];

// A shop's own payment processor connection, used to collect payment
// directly from their customers — entirely separate from the platform's
// own Stripe billing (Shop.stripeCustomerId/stripeSubscriptionId in the
// platform DB). The platform never touches this money: charges land
// directly in the shop's connected account via Stripe Connect, and we
// only ever act on their behalf using our platform key + this account id.
export const paymentConnectionSchema = new Schema(
  {
    provider: { type: String, enum: PAYMENT_OAUTH_PROVIDERS, required: true },
    // Stripe Connect's acct_... id (or dummy_acct_... for the test fallback)
    connectedAccountId: { type: String, required: true },
    accountLabel: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
paymentConnectionSchema.index({ provider: 1 }, { unique: true });

export type PaymentConnection = InferSchemaType<typeof paymentConnectionSchema>;
