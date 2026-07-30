import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";
import PlatformUser from "../models/platform/PlatformUser.js";

// Same chicken-and-egg problem as the shop-admin bootstrap: the platform
// console has no signup either, so the very first Platform Owner has to be
// created here, once. Every other platform team member is created
// afterward through the console itself.
async function main() {
  const email = process.env.OWNER_EMAIL;
  const name = process.env.OWNER_NAME ?? "Owner";

  if (!email) {
    console.error("Usage: OWNER_EMAIL=you@yourcompany.com npm run bootstrap-owner");
    process.exit(1);
  }

  await mongoose.connect(getMongoUri(process.env.MONGODB_URI), { dbName: "platform" });

  const normalizedEmail = email.toLowerCase();
  const existing = await PlatformUser.findOne({ email: normalizedEmail });
  if (existing) {
    console.error(`Platform user ${normalizedEmail} already exists.`);
    process.exit(1);
  }

  const password = process.env.OWNER_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await PlatformUser.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: "owner",
    active: true,
  });

  console.log("Platform Owner created:");
  console.log(`  email:    ${normalizedEmail}`);
  console.log(`  password: ${password}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
