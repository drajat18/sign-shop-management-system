import { Schema, type InferSchemaType } from "mongoose";

// Manual on-hand tracking, separate from the per-order material cost
// estimate (materialPricing.ts) — that's a "what would this cost to buy"
// lookup; this is "how much do we actually have in the shop right now".
// Not auto-deducted when an order is placed, since order items only carry
// a free-text material name (no SKU link to match against this list).
export const materialStockSchema = new Schema(
  {
    materialName: { type: String, required: true },
    unit: { type: String, required: true, default: "each" },
    quantityOnHand: { type: Number, required: true, default: 0 },
    reorderThreshold: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

export type MaterialStock = InferSchemaType<typeof materialStockSchema>;
