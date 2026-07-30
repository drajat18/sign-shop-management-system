import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import ShopUserIndex from "../models/platform/ShopUserIndex.js";
import { runMigrationsForShop } from "./migrationRunner.js";
import { getShopConnection } from "./shopConnection.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface ProvisionShopInput {
  shopName: string;
  adminEmail: string;
  adminName?: string;
  planTier?: string;
  adminPassword?: string;
}

// Shared by the provision-shop CLI script and the platform console's
// "create shop" action — this *is* the entire manual-onboarding workflow,
// so it only lives in one place.
export async function provisionShop(input: ProvisionShopInput) {
  const normalizedEmail = input.adminEmail.toLowerCase();

  const existingIndex = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (existingIndex) {
    throw new Error(`Email ${normalizedEmail} is already associated with a shop.`);
  }

  const baseSlug = slugify(input.shopName);
  let slug = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Shop.findOne({ slug })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const shop = await Shop.create({
    name: input.shopName,
    slug,
    planTier: input.planTier ?? "starter",
  });

  const connection = getShopConnection(shop.id);
  await runMigrationsForShop(connection);

  const password = input.adminPassword ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  const { User } = getShopModels(connection);
  await User.create({
    name: input.adminName ?? "Admin",
    email: normalizedEmail,
    passwordHash,
    role: "admin",
    active: true,
  });
  await ShopUserIndex.create({ email: normalizedEmail, shopId: shop._id });

  return { shop, adminEmail: normalizedEmail, adminPassword: password };
}
