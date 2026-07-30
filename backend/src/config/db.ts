import mongoose from "mongoose";

// Every route returns Mongoose documents straight to res.json(); without
// this, responses carry `_id` but not the `id` string the frontend reads.
mongoose.set("toJSON", { virtuals: true, versionKey: false });
mongoose.set("toObject", { virtuals: true, versionKey: false });

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/sign-shop";

export function getMongoUri(uri?: string): string {
  const configuredUri = uri?.trim() ?? process.env.MONGODB_URI?.trim();

  if (!configuredUri || configuredUri.includes("<") || configuredUri.includes(">")) {
    return DEFAULT_MONGODB_URI;
  }

  return configuredUri;
}

// The default Mongoose connection is reserved for the platform database
// (shop registry, platform team, the email->shop login index) — every
// shop's actual data lives in its own database via a separate connection
// from services/shopConnection.ts.
export async function connectDB(uri?: string): Promise<void> {
  await mongoose.connect(getMongoUri(uri), { dbName: "platform" });
}
