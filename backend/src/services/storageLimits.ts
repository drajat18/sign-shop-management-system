import Shop, { type PlanTier } from "../models/platform/Shop.js";
import type { ShopModels } from "../models/shopModels.js";

const GB = 1024 ** 3;

// Only internal (platform-hosted) storage counts against the quota —
// Dropbox/Google Drive files live in the shop's own account and cost the
// platform nothing, so they're excluded everywhere below.
export const STORAGE_LIMITS_GB: Record<PlanTier, number> = {
  starter: 5,
  growth: 25,
  pro: 100,
};

export const STORAGE_ADDON_GB = 25;
export const STORAGE_ADDON_PRICE_USD = 9.99;
export const STORAGE_ADDON_PRICE_ID = process.env.STRIPE_PRICE_STORAGE_ADDON;

// Shop-scoped routes only ever get shopId off the JWT — the plan and addon
// count live in the platform DB (Shop registry), not the shop's own
// database, mirroring getShopPlanTier in planLimits.ts.
export async function getShopStorageLimitBytes(shopId: string): Promise<number> {
  const shop = await Shop.findById(shopId).select("planTier storageAddons");
  const tier = (shop?.planTier as PlanTier) ?? "starter";
  const addons = shop?.storageAddons ?? 0;
  return (STORAGE_LIMITS_GB[tier] + addons * STORAGE_ADDON_GB) * GB;
}

export async function getShopStorageUsedBytes(FileRecord: ShopModels["FileRecord"]): Promise<number> {
  const [result] = await FileRecord.aggregate<{ total: number }>([
    { $match: { storageProvider: "internal" } },
    { $group: { _id: null, total: { $sum: "$fileSize" } } },
  ]);
  return result?.total ?? 0;
}
