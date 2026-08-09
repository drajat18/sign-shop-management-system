import { Schema, type InferSchemaType } from "mongoose";

export const ORDER_MESSAGE_SENDERS = ["staff", "customer"] as const;

// The real conversation history between a shop and its customer for one
// order — replaces the old single-field customerComment, which had no
// history and vanished the moment staff dismissed it or the customer sent
// a newer one.
export const orderMessageSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    sender: { type: String, enum: ORDER_MESSAGE_SENDERS, required: true },
    // Only set for sender: "staff" — who on the team sent it.
    staffUser: { type: Schema.Types.ObjectId, ref: "User" },
    body: { type: String, required: true },
    // Only meaningful for sender: "customer" — cleared in bulk the moment
    // staff load the thread (see GET /orders/:id/messages).
    readByStaff: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type OrderMessage = InferSchemaType<typeof orderMessageSchema>;
