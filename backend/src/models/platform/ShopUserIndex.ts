import { Schema, model, type InferSchemaType } from "mongoose";

// Login needs to know which shop's database to query before it can even
// check a password — this is that lookup. Kept in sync whenever a shop
// employee is created or removed. One email = one shop, platform-wide.
const shopUserIndexSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    shopId: { type: Schema.Types.ObjectId, required: true, ref: "Shop" },
  },
  { timestamps: true }
);

export type ShopUserIndex = InferSchemaType<typeof shopUserIndexSchema>;
export default model("ShopUserIndex", shopUserIndexSchema);
