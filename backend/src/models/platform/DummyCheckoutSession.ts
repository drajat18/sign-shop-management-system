import { Schema, model, type InferSchemaType } from "mongoose";
import { PLAN_TIERS } from "./Shop.js";

export const DUMMY_CHECKOUT_KINDS = ["plan", "storage_addon"] as const;

// Stand-in for a real Stripe Checkout Session when no Stripe account is
// configured yet — lets the whole billing-link → pay → status-update loop
// be exercised end to end without any external dependency. Once real
// Stripe keys exist, /billing-link and /checkout-link stop creating these
// entirely. "kind" distinguishes a plan-tier subscription from a storage
// add-on purchase — planTier is only meaningful (and only set) for "plan".
const dummyCheckoutSessionSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, required: true, ref: "Shop" },
    kind: { type: String, enum: DUMMY_CHECKOUT_KINDS, default: "plan" },
    planTier: { type: String, enum: PLAN_TIERS },
    token: { type: String, required: true, unique: true },
    completedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type DummyCheckoutSession = InferSchemaType<typeof dummyCheckoutSessionSchema>;
export default model("DummyCheckoutSession", dummyCheckoutSessionSchema);
