import { Schema, type InferSchemaType } from "mongoose";

// "quote" is a holding stage, not a real order yet: it skips the due-date
// requirement, doesn't spawn a production job for its items, and doesn't
// notify a customer anything is "in production" — see POST /orders and
// POST /orders/:id/convert-to-order. Every other status is a committed job.
export const ORDER_STATUSES = [
  "quote",
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;

export const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    dueDate: Date,
    description: String,
    status: { type: String, enum: ORDER_STATUSES, default: "new" },
    total: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
    // Derived from the Payment ledger (see Payment.ts) — the source of
    // truth for how much has actually been collected, online or in
    // person. paymentStatus above is kept in sync with this automatically
    // whenever a payment is recorded, but stays manually overridable for
    // edge cases (a comped job, a correction) without needing a payment
    // record to exist.
    amountPaid: { type: Number, default: 0 },
    // Installation is optional per order (not every sign gets installed by
    // the shop — some are picked up), so these only matter when
    // installRequired is set. installCharge folds into `total` alongside
    // the line items. installDate is separate from dueDate — dueDate is
    // "ready by," installDate is when a crew is actually on site, which is
    // frequently a different day.
    installRequired: { type: Boolean, default: false },
    installAddress: String,
    installCharge: { type: Number, default: 0 },
    installDate: Date,
    // Which employee (any role — installers aren't a separate role in this
    // app) is on the hook for the install. Purely informational; doesn't
    // gate who can edit the order.
    installAssignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Set once this order's been pushed to (or marked synced with) an
    // accounting system — see settingsAccounting.routes.ts. Null/undefined
    // means "never synced," not "synced and failed."
    accountingSyncedAt: Date,
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
