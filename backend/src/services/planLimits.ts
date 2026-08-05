import Shop, { PLAN_TIERS, type PlanTier } from "../models/platform/Shop.js";

// Only Employees (seat count) differs by number — everything else is a
// flat feature unlock. BYO storage and payment collection are available
// on every tier; Reports, the customer portal, and QR job tickets are
// Growth and up.
export const EMPLOYEE_LIMITS: Record<PlanTier, number | null> = {
  starter: 3,
  growth: 10,
  pro: null, // unlimited
};

export type GatedFeature = "reports" | "customer_portal" | "qr_tickets";

const FEATURE_MIN_TIER: Record<GatedFeature, PlanTier> = {
  reports: "growth",
  customer_portal: "growth",
  qr_tickets: "growth",
};

const TIER_RANK: Record<PlanTier, number> = Object.fromEntries(
  PLAN_TIERS.map((tier, i) => [tier, i])
) as Record<PlanTier, number>;

export function tierIncludes(shopTier: PlanTier, feature: GatedFeature): boolean {
  return TIER_RANK[shopTier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

// Shop-scoped routes only ever get shopId off the JWT — the plan itself
// lives in the platform DB (Shop registry), not the shop's own database,
// so every gate check costs one small cross-database lookup.
export async function getShopPlanTier(shopId: string): Promise<PlanTier> {
  const shop = await Shop.findById(shopId).select("planTier");
  return (shop?.planTier as PlanTier) ?? "starter";
}
