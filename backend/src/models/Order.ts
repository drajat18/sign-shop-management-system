import { Schema, model, type InferSchemaType } from "mongoose";

export const ORDER_STATUSES = [
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
] as const;

const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    dueDate: Date,
    status: { type: String, enum: ORDER_STATUSES, default: "new" },
    total: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type Order = InferSchemaType<typeof orderSchema>;
export default model("Order", orderSchema);
