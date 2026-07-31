import { Schema, type InferSchemaType } from "mongoose";

export const ORDER_STATUSES = [
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
] as const;

export const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    dueDate: Date,
    description: String,
    status: { type: String, enum: ORDER_STATUSES, default: "new" },
    total: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Latest "request changes" note left by the customer via their portal
    // link — a single field rather than a thread, cleared by staff once
    // addressed via the same PATCH used for every other order field.
    customerComment: String,
  },
  { timestamps: true }
);

export type Order = InferSchemaType<typeof orderSchema>;
