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
    // Installation is optional per order (not every sign gets installed by
    // the shop — some are picked up), so these only matter when
    // installRequired is set. installCharge folds into `total` alongside
    // the line items.
    installRequired: { type: Boolean, default: false },
    installAddress: String,
    installCharge: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Lightweight "something needs a look" flag — the actual conversation
    // lives in the OrderMessage collection (a real thread, not a single
    // overwritable field). Set whenever the customer approves a design or
    // sends a new message via their portal link; cleared automatically the
    // moment staff open the order's message thread (GET /:id/messages),
    // the same way opening a chat marks it read.
    customerResponseType: String,
  },
  { timestamps: true }
);

export type Order = InferSchemaType<typeof orderSchema>;
