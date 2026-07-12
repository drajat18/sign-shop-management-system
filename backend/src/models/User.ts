import { Schema, model, type InferSchemaType } from "mongoose";
import { ROLES } from "../types/roles.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;
export default model("User", userSchema);
