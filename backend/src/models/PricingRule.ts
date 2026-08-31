import { Schema, type InferSchemaType } from "mongoose";

export const PRICING_METHODS = ["flat", "per_sqft", "cost_plus"] as const;
export type PricingMethod = (typeof PRICING_METHODS)[number];

// Lets a shop define "how we price this kind of sign" once instead of
// guessing a number by hand every time — the three methods mirror what
// Cyrious/shopVOX both ship: a flat catalog rate, a per-square-foot rate,
// or a margin on top of material cost. Matched against a line item by
// signType (case-insensitive, trimmed); "default" matches anything with no
// more specific rule.
export const pricingRuleSchema = new Schema(
  {
    signType: { type: String, required: true, trim: true },
    method: { type: String, enum: PRICING_METHODS, required: true },
    flatPrice: Number,
    pricePerSqft: Number,
    // Percent markup applied on top of the item's materialCostEstimate —
    // e.g. 150 means "charge 2.5x material cost." Only meaningful once a
    // real material-cost source exists; today that's still the simulated
    // "Check pricing" lookup, so a cost_plus rule is only as real as that
    // input is.
    costPlusMarginPercent: Number,
    minPrice: Number,
  },
  { timestamps: true }
);
pricingRuleSchema.index({ signType: 1 }, { unique: true });

export type PricingRule = InferSchemaType<typeof pricingRuleSchema>;
