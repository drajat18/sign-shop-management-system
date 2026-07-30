import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import ShopUserIndex from "../models/platform/ShopUserIndex.js";
import { runMigrationsForShop } from "../services/migrationRunner.js";
import { getShopConnection } from "../services/shopConnection.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// This *is* manual onboarding: run once per new shop after their
// requirements/agreements are confirmed. Creates the shop's own database
// and its first Admin login. Every other employee account for that shop
// is created afterward through the app itself, via POST /api/users.
async function provisionShop() {
  const shopName = process.env.SHOP_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  if (!shopName || !adminEmail) {
    console.error(
      'Usage: SHOP_NAME="Acme Signs" ADMIN_EMAIL=owner@acmesigns.com npm run provision-shop'
    );
    process.exit(1);
  }

  await mongoose.connect(getMongoUri(process.env.MONGODB_URI), { dbName: "platform" });

  const normalizedEmail = adminEmail.toLowerCase();
  const existingIndex = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (existingIndex) {
    console.error(`Email ${normalizedEmail} is already associated with a shop.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const baseSlug = slugify(shopName);
  let slug = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Shop.findOne({ slug })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const shop = await Shop.create({
    name: shopName,
    slug,
    planTier: process.env.PLAN_TIER ?? "starter",
  });

  const password = process.env.ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  const connection = getShopConnection(shop.id);
  await runMigrationsForShop(connection);

  const { User } = getShopModels(connection);
  await User.create({
    name: adminName,
    email: normalizedEmail,
    passwordHash,
    role: "admin",
    active: true,
  });
  await ShopUserIndex.create({ email: normalizedEmail, shopId: shop._id });

  console.log(`Provisioned shop "${shop.name}" (slug: ${shop.slug}, plan: ${shop.planTier})`);
  console.log("Admin login:");
  console.log(`  email:    ${normalizedEmail}`);
  console.log(`  password: ${password}`);

  // Shop connections are separate from the default (platform) connection,
  // so mongoose.disconnect() alone won't close them — exit forces it.
  process.exit(0);
}

provisionShop().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
