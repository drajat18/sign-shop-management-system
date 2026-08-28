import { Schema, type InferSchemaType } from "mongoose";

export const NOTIFICATION_CHANNELS = ["email", "sms"] as const;

// A record of every notification actually sent (or dummy-logged), so
// there's something to look at even before a shop has real SMTP/Twilio
// credentials configured — mirrors DummyCheckoutSession's role for billing.
export const NOTIFICATION_STATUSES = ["sent", "failed"] as const;

export const notificationLogSchema = new Schema(
  {
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    to: { type: String, required: true },
    subject: String,
    body: { type: String, required: true },
    trigger: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    // Defaults to "sent" so every pre-existing row (and the dummy-mode
    // console-log path, which never fails) reads correctly without a
    // migration — only a real, caught delivery failure ever sets "failed".
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "sent" },
    error: String,
  },
  { timestamps: true }
);

export type NotificationLog = InferSchemaType<typeof notificationLogSchema>;
