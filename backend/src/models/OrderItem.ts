import { Schema, model, type InferSchemaType } from "mongoose";

const orderItemSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    signType: { type: String, required: true },
    size: String,
    material: String,
    artworkFile: { type: Schema.Types.ObjectId, ref: "FileRecord" },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

export type OrderItem = InferSchemaType<typeof orderItemSchema>;
export default model("OrderItem", orderItemSchema);
