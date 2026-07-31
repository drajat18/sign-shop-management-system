import { Schema, model, type InferSchemaType } from "mongoose";

export const PLAN_TIERS = ["starter", "growth", "pro"] as const;
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// A shop's actual data database is named `shop_${shop.id}` by convention —
// derived from this document's _id, never stored separately, so there's
// no way for the two to drift out of sync.
const shopSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    planTier: { type: String, enum: PLAN_TIERS, default: "starter" },
    subscriptionStatus: { type: String, enum: SUBSCRIPTION_STATUSES, default: "trialing" },
    active: { type: Boolean, default: true },
    // Set once a shop completes Stripe Checkout via a billing link — absent
    // for shops still on the default "trialing" status pre-payment.
    stripeCustomerId: String,
    stripeSubscriptionId: String,
  },
  { timestamps: true }
);

export type Shop = InferSchemaType<typeof shopSchema>;
export default model("Shop", shopSchema);
