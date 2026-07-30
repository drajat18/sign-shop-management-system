import "dotenv/config";
import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";
import { provisionShop } from "../services/provisionShop.js";

// This *is* manual onboarding: run once per new shop after their
// requirements/agreements are confirmed. Creates the shop's own database
// and its first Admin login. Every other employee account for that shop
// is created afterward through the app itself, via POST /api/users. Also
// available from the platform console (POST /api/platform/shops) — this
// script and that route share the same provisionShop() service.
async function main() {
  const shopName = process.env.SHOP_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!shopName || !adminEmail) {
    console.error(
      'Usage: SHOP_NAME="Acme Signs" ADMIN_EMAIL=owner@acmesigns.com npm run provision-shop'
    );
    process.exit(1);
  }

  await mongoose.connect(getMongoUri(process.env.MONGODB_URI), { dbName: "platform" });

  try {
    const result = await provisionShop({
      shopName,
      adminEmail,
      adminName: process.env.ADMIN_NAME,
      planTier: process.env.PLAN_TIER,
      adminPassword: process.env.ADMIN_PASSWORD,
    });
    console.log(
      `Provisioned shop "${result.shop.name}" (slug: ${result.shop.slug}, plan: ${result.shop.planTier})`
    );
    console.log("Admin login:");
    console.log(`  email:    ${result.adminEmail}`);
    console.log(`  password: ${result.adminPassword}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Shop connections are separate from the default (platform) connection,
  // so mongoose.disconnect() alone won't close them — exit forces it.
  process.exit(0);
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
