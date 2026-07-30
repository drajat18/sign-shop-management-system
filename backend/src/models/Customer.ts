import { Schema, type InferSchemaType } from "mongoose";

export const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    notes: String,
  },
  { timestamps: true }
);

export type Customer = InferSchemaType<typeof customerSchema>;
