import { Schema, model, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    notes: String,
  },
  { timestamps: true }
);

export type Customer = InferSchemaType<typeof customerSchema>;
export default model("Customer", customerSchema);
