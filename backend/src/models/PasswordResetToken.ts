import { Schema, type InferSchemaType } from "mongoose";

// Only ever stores a hash of the token — the raw token exists solely in
// the email sent to the user and the URL they click.
export const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>;
