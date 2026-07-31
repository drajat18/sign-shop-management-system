import { Schema, type InferSchemaType } from "mongoose";

// One shareable link per order, generated on demand by staff and handed to
// the customer out of band (text/email/verbally) — no customer account or
// password, the token itself is the access credential for that one order.
//
// Stored as plaintext (not hashed, unlike PasswordResetToken) so staff can
// re-fetch and re-share the *same* link on request without invalidating a
// copy the customer may have already bookmarked. This is a tracking link,
// not a password — the same risk profile as most order-tracking systems.
export const customerPortalTokenSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type CustomerPortalToken = InferSchemaType<typeof customerPortalTokenSchema>;
