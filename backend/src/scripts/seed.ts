import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";
import User from "../models/User.js";

// Bootstraps the first Admin account. Every other employee account is
// created afterward through POST /api/users by that Admin — this script
// only exists to break the chicken-and-egg problem of needing an Admin
// to create an Admin.
async function seed() {
  await mongoose.connect(getMongoUri(process.env.MONGODB_URI));

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@signshop.test";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin account already exists for ${email} — skipping.`);
    await mongoose.disconnect();
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    name: "Admin",
    email,
    passwordHash,
    role: "admin",
    active: true,
  });

  console.log("Seeded admin account:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("Log in with these, then create real employee accounts via POST /api/users and retire this one.");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
