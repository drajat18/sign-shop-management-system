import { Schema, type InferSchemaType } from "mongoose";

export const orderItemSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    signType: { type: String, required: true },
    size: String,
    // Numeric dimensions, in inches — optional and separate from the free-text
    // `size` field above (kept for jobs that aren't a simple rectangle).
    // Feeds two things: per-sqft pricing rules, and area-based inventory
    // consumption for materials tracked by the square foot.
    widthIn: Number,
    heightIn: Number,
    material: String,
    // Optional link to a tracked MaterialStock record — set when the
    // material typed/selected above matches a real inventory item, which is
    // what makes automatic stock consumption reliable (see orders.routes.ts
    // and orderItems.routes.ts). Free-text `material` stays the source of
    // truth for display; this is purely a consumption pointer.
    materialStock: { type: Schema.Types.ObjectId, ref: "MaterialStock" },
    // Snapshot of how much stock this item actually deducted, captured at
    // the moment consumption happened — restocking on delete/cancel always
    // reverses exactly this amount, regardless of later edits to quantity
    // or dimensions.
    materialConsumedQty: { type: Number, default: 0 },
    description: String,
    artworkFile: { type: Schema.Types.ObjectId, ref: "FileRecord" },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    // Staff-only estimate of what this line item's material will cost to
    // source — separate from `price`, which is what the customer is
    // charged. Populated by the "Check pricing" lookup, not required.
    materialCostEstimate: Number,
    materialCostVendor: String,
  },
  { timestamps: true }
);

export type OrderItem = InferSchemaType<typeof orderItemSchema>;
