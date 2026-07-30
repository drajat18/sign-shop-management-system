import { Schema, type InferSchemaType } from "mongoose";

// Logins and admin actions — separate from StatusLog, which only tracks
// order/job status transitions. Groundwork for SOC 2 and for a future
// "who from support touched our account" view for shops.
export const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    actorEmail: String,
    targetId: Schema.Types.ObjectId,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
