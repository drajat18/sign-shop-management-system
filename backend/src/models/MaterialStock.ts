import { Schema, type InferSchemaType } from "mongoose";

// Manual on-hand tracking, separate from the per-order material cost
// estimate (materialPricing.ts) — that's a "what would this cost to buy"
// lookup; this is "how much do we actually have in the shop right now".
// Order items can optionally link to a specific record here (see
// OrderItem.materialStock) for reliable automatic consumption — reliable
// because it's a real reference, not a free-text name match.
export const materialStockSchema = new Schema(
  {
    materialName: { type: String, required: true },
    unit: { type: String, required: true, default: "each" },
    // When true, an order item consuming this material is deducted by its
    // area in square feet (from OrderItem widthIn × heightIn × quantity)
    // instead of a flat 1-per-item — set this for anything sold/stocked by
    // the sheet or roll rather than as discrete pieces.
    isAreaBased: { type: Boolean, default: false },
    quantityOnHand: { type: Number, required: true, default: 0 },
    reorderThreshold: { type: Number, default: 0 },
    notes: String,
    // Who to call when this needs restocking, and roughly how long it
    // takes once ordered — the two things "we're low on this" is actually
    // missing without a full vendor/PO system.
    vendorName: String,
    vendorContact: String,
    leadTimeDays: Number,
  },
  { timestamps: true }
);

export type MaterialStock = InferSchemaType<typeof materialStockSchema>;
