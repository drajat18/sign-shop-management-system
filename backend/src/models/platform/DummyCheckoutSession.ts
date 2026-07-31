import { Schema, model, type InferSchemaType } from "mongoose";
import { PLAN_TIERS } from "./Shop.js";

// Stand-in for a real Stripe Checkout Session when no Stripe account is
// configured yet — lets the whole billing-link → pay → status-update loop
// be exercised end to end without any external dependency. Once real
// Stripe keys exist, /billing-link stops creating these entirely.
const dummyCheckoutSessionSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, required: true, ref: "Shop" },
    planTier: { type: String, enum: PLAN_TIERS, required: true },
    token: { type: String, required: true, unique: true },
    completedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type DummyCheckoutSession = InferSchemaType<typeof dummyCheckoutSessionSchema>;
export default model("DummyCheckoutSession", dummyCheckoutSessionSchema);
