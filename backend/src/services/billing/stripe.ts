import Stripe from "stripe";
import type { PlanTier } from "../../models/platform/Shop.js";

export const STRIPE_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;

// Every caller goes through this instead of constructing its own Stripe
// client, so there's exactly one place that decides whether billing is
// live — mirrors the fileStorage provider's env-var feature detection.
export function getStripe(): Stripe {
  if (!STRIPE_CONFIGURED) {
    throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY to enable billing.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}

// Sign shops don't set their own prices — the platform's three tiers are
// fixed, configured here and mirrored as actual Stripe Prices via env vars
// once a real Stripe account exists.
export const PLAN_PRICES_USD: Record<PlanTier, number> = {
  starter: 59.99,
  growth: 119.99,
  pro: 199.99,
};

export const PLAN_PRICE_IDS: Record<PlanTier, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
};

export function priceIdForTier(tier: PlanTier): string {
  const priceId = PLAN_PRICE_IDS[tier];
  if (!priceId) {
    throw new Error(`No Stripe price configured for the "${tier}" plan.`);
  }
  return priceId;
}

// Reverse lookup used by the webhook handler, which only knows the Stripe
// price ID a subscription is on and needs to translate that back to one of
// our plan tiers.
export function tierForPriceId(priceId: string): PlanTier | undefined {
  return (Object.entries(PLAN_PRICE_IDS) as [PlanTier, string | undefined][]).find(
    ([, id]) => id === priceId
  )?.[0];
}
