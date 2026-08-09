import { Router } from "express";
import DummyCheckoutSession from "../models/platform/DummyCheckoutSession.js";
import Shop from "../models/platform/Shop.js";
import { PLAN_PRICES_USD } from "../services/billing/stripe.js";
import { STORAGE_ADDON_PRICE_USD } from "../services/storageLimits.js";

// Entirely public — same shape as the customer portal token: the link
// itself is the only credential, scoped to one shop's one pending
// "subscription". Only reachable at all when a real Stripe account isn't
// configured (see shops.routes.ts billing-link / settingsBilling.routes.ts),
// so it can't be used to bypass real billing once one exists.
const router = Router();

router.get("/:token", async (req, res) => {
  const session = await DummyCheckoutSession.findOne({ token: req.params.token });
  if (!session) return res.status(404).json({ error: "This link is invalid or has expired." });

  const shop = await Shop.findById(session.shop);
  if (!shop) return res.status(404).json({ error: "This link is invalid or has expired." });

  res.json({
    shopName: shop.name,
    kind: session.kind,
    planTier: session.planTier,
    quantity: session.quantity ?? 1,
    priceUsd:
      session.kind === "storage_addon"
        ? STORAGE_ADDON_PRICE_USD * (session.quantity ?? 1)
        : PLAN_PRICES_USD[session.planTier as keyof typeof PLAN_PRICES_USD],
    completed: Boolean(session.completedAt),
  });
});

router.post("/:token/complete", async (req, res) => {
  const session = await DummyCheckoutSession.findOne({ token: req.params.token });
  if (!session) return res.status(404).json({ error: "This link is invalid or has expired." });
  if (session.expiresAt < new Date()) {
    return res.status(400).json({ error: "This link has expired." });
  }

  const shop = await Shop.findById(session.shop);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  if (!session.completedAt) {
    session.completedAt = new Date();
    await session.save();

    if (session.kind === "storage_addon") {
      shop.storageAddons = (shop.storageAddons ?? 0) + (session.quantity ?? 1);
    } else if (session.planTier) {
      // "dummy_" prefix keeps these unmistakable from real Stripe IDs (which
      // are always "cus_"/"sub_") so nobody mistakes a test subscription for
      // a paying one once real billing is turned on.
      shop.planTier = session.planTier;
      shop.subscriptionStatus = "active";
      shop.stripeCustomerId = `dummy_cus_${shop.id}`;
      shop.stripeSubscriptionId = `dummy_sub_${session.token}`;
    }
    await shop.save();
  }

  res.json({ message: session.kind === "storage_addon" ? "Test storage add-on activated." : "Test subscription activated." });
});

export default router;
