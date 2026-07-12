import { Schema, model, type InferSchemaType } from "mongoose";

const statusLogSchema = new Schema(
  {
    entityType: { type: String, enum: ["order", "production_job"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fromStatus: String,
    toStatus: { type: String, required: true },
  },
  { timestamps: true }
);

export type StatusLog = InferSchemaType<typeof statusLogSchema>;
export default model("StatusLog", statusLogSchema);
