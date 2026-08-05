import { Schema, type InferSchemaType } from "mongoose";

export const orderItemSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    signType: { type: String, required: true },
    size: String,
    material: String,
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
