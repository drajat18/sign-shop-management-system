import { Schema, type InferSchemaType } from "mongoose";

export const PAYMENT_OAUTH_PROVIDERS = ["stripe", "square", "paypal"] as const;
export type PaymentOAuthProvider = (typeof PAYMENT_OAUTH_PROVIDERS)[number];

// A shop's own payment processor connection, used to collect payment
// directly from their customers — entirely separate from the platform's
// own Stripe billing (Shop.stripeCustomerId/stripeSubscriptionId in the
// platform DB). The platform never touches this money.
//
// Stripe and PayPal act on a shop's behalf using the platform's own key
// plus connectedAccountId (Stripe's acct_..., PayPal's merchant_id) — no
// token storage needed. Square's model is different: OAuth hands back the
// merchant's own access/refresh token, used directly instead of a
// platform-level key, so those are stored here only for Square.
export const paymentConnectionSchema = new Schema(
  {
    provider: { type: String, enum: PAYMENT_OAUTH_PROVIDERS, required: true },
    connectedAccountId: { type: String, required: true },
    accountLabel: String,
    accessToken: String,
    refreshToken: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
paymentConnectionSchema.index({ provider: 1 }, { unique: true });

export type PaymentConnection = InferSchemaType<typeof paymentConnectionSchema>;
