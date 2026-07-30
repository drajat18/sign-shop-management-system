import { Schema, model, type InferSchemaType } from "mongoose";
import { PLATFORM_ROLES } from "../../types/platformRoles.js";

// Your internal team (Owner/Support/Billing/Onboarding) — entirely
// separate from any shop's employees. Lives in the platform database.
const platformUserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: PLATFORM_ROLES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type PlatformUser = InferSchemaType<typeof platformUserSchema>;
export default model("PlatformUser", platformUserSchema);
