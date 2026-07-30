import { Schema, type InferSchemaType } from "mongoose";

export const JOB_STATUSES = ["queued", "in_progress", "blocked", "done"] as const;

export const productionJobSchema = new Schema(
  {
    orderItem: { type: Schema.Types.ObjectId, ref: "OrderItem", required: true },
    status: { type: String, enum: JOB_STATUSES, default: "queued" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: true }
);

export type ProductionJob = InferSchemaType<typeof productionJobSchema>;
