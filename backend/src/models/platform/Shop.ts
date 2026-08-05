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
    // Count of +25GB storage add-on units purchased, stackable on top of
    // the plan tier's base quota, independent of which tier the shop is on.
    storageAddons: { type: Number, default: 0 },
    // Real-Stripe subscription IDs backing each purchased add-on unit, so
    // the webhook can tell which one was cancelled and decrement precisely.
    // Empty for shops on the dummy billing fallback.
    storageAddonSubscriptionIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type Shop = InferSchemaType<typeof shopSchema>;
export default model("Shop", shopSchema);
