import { Schema, type InferSchemaType } from "mongoose";

export const PAYMENT_METHODS = ["cash", "card_in_person", "check", "online", "other"] as const;

// An immutable record of money actually received against an order —
// in-person payments recorded by staff, and (going forward) completed
// online charge-link payments. This is what makes paymentStatus something
// derived from real dollars instead of a label staff picks from a
// dropdown, and it's the ledger the A/R aging report reads from.
export const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    note: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export type Payment = InferSchemaType<typeof paymentSchema>;
