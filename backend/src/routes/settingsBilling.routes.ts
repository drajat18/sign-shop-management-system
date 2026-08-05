import crypto from "node:crypto";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import DummyCheckoutSession from "../models/platform/DummyCheckoutSession.js";
import Shop, { PLAN_TIERS, type PlanTier } from "../models/platform/Shop.js";
import { getStripe, priceIdForTier, STRIPE_CONFIGURED } from "../services/billing/stripe.js";
import { STORAGE_ADDON_PRICE_ID } from "../services/storageLimits.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const DUMMY_CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// Self-serve version of platform/shops.routes.ts's /billing-link — same
// dummy-fallback pattern, but callable by a shop's own admin instead of
// requiring a platform team member to generate and hand over a link.
router.post("/checkout-link", async (req, res) => {
  const shop = await Shop.findById(req.auth!.shopId);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const { planTier } = req.body as { planTier?: string };
  if (!planTier || !PLAN_TIERS.includes(planTier as PlanTier)) {
    return res.status(400).json({ error: `planTier must be one of: ${PLAN_TIERS.join(", ")}` });
  }

  if (!STRIPE_CONFIGURED) {
    const dummySession = await DummyCheckoutSession.create({
      shop: shop.id,
      kind: "plan",
      planTier,
      token: crypto.randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + DUMMY_CHECKOUT_TTL_MS),
    });
    return res.json({
      url: `${process.env.FRONTEND_URL}/billing/dummy-checkout/${dummySession.token}`,
      mode: "dummy",
    });
  }

  let priceId: string;
  try {
    priceId = priceIdForTier(planTier as PlanTier);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: shop.stripeCustomerId || undefined,
    client_reference_id: shop.id,
    metadata: { shopId: shop.id, planTier, kind: "plan" },
    subscription_data: { metadata: { shopId: shop.id, planTier, kind: "plan" } },
    success_url: `${process.env.FRONTEND_URL}/admin?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/admin?billing=cancelled`,
  });

  res.json({ url: session.url, mode: "stripe" });
});

// Purchases one +25GB storage add-on unit, stackable regardless of plan
// tier — same checkout shape as above, just a flat add-on price instead of
// a tier price, and the completion effect increments storageAddons rather
// than changing planTier (see billingDummy.routes.ts / stripeWebhook.routes.ts).
router.post("/storage-addon-link", async (req, res) => {
  const shop = await Shop.findById(req.auth!.shopId);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  if (!STRIPE_CONFIGURED) {
    const dummySession = await DummyCheckoutSession.create({
      shop: shop.id,
      kind: "storage_addon",
      token: crypto.randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + DUMMY_CHECKOUT_TTL_MS),
    });
    return res.json({
      url: `${process.env.FRONTEND_URL}/billing/dummy-checkout/${dummySession.token}`,
      mode: "dummy",
    });
  }

  if (!STORAGE_ADDON_PRICE_ID) {
    return res.status(400).json({ error: "Storage add-on pricing isn't configured." });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: STORAGE_ADDON_PRICE_ID, quantity: 1 }],
    customer: shop.stripeCustomerId || undefined,
    client_reference_id: shop.id,
    metadata: { shopId: shop.id, kind: "storage_addon" },
    subscription_data: { metadata: { shopId: shop.id, kind: "storage_addon" } },
    success_url: `${process.env.FRONTEND_URL}/admin?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/admin?billing=cancelled`,
  });

  res.json({ url: session.url, mode: "stripe" });
});

export default router;
