import { Router } from "express";
import jwt from "jsonwebtoken";
import { requirePlatformAuth } from "../../middleware/platformAuth.js";
import { requirePlatformRole } from "../../middleware/requirePlatformRole.js";
import { getShopModels } from "../../models/shopModels.js";
import PlatformUser from "../../models/platform/PlatformUser.js";
import Shop, { PLAN_TIERS, type PlanTier } from "../../models/platform/Shop.js";
import { getStripe, priceIdForTier, STRIPE_CONFIGURED } from "../../services/billing/stripe.js";
import { provisionShop } from "../../services/provisionShop.js";
import { getShopConnection } from "../../services/shopConnection.js";

const router = Router();

router.use(requirePlatformAuth);

router.get("/", async (_req, res) => {
  res.json(await Shop.find().sort({ createdAt: -1 }));
});

router.get("/:id", async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: "Shop not found" });
  res.json(shop);
});

// A shop's own admin can't deactivate their own account (that would be an
// instant, unrecoverable lockout if they're the only admin — see
// users.routes.ts). This is the actual recovery path for that case: the
// platform Owner can deactivate any user in any shop, including its admins.
router.get("/:id/users", requirePlatformRole("owner", "support"), async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const { User } = getShopModels(getShopConnection(shop.id));
  res.json(await User.find().select("-passwordHash").sort({ createdAt: -1 }));
});

router.patch("/:id/users/:userId/deactivate", requirePlatformRole("owner"), async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const platformUser = await PlatformUser.findById(req.platformAuth!.platformUserId);
  if (!platformUser) return res.status(401).json({ error: "Invalid token" });

  const { User, AuditLog } = getShopModels(getShopConnection(shop.id));
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { active: false },
    { new: true }
  ).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });

  await AuditLog.create({
    action: "employee_deactivated",
    actorUserId: user._id,
    actorEmail: platformUser.email,
    targetId: user._id,
    metadata: { deactivatedByPlatform: true, platformUserId: platformUser.id, platformUserName: platformUser.name },
  });

  res.json(user);
});

router.patch("/:id/users/:userId/reactivate", requirePlatformRole("owner"), async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const platformUser = await PlatformUser.findById(req.platformAuth!.platformUserId);
  if (!platformUser) return res.status(401).json({ error: "Invalid token" });

  const { User, AuditLog } = getShopModels(getShopConnection(shop.id));
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { active: true },
    { new: true }
  ).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });

  await AuditLog.create({
    action: "employee_reactivated",
    actorUserId: user._id,
    actorEmail: platformUser.email,
    targetId: user._id,
    metadata: { reactivatedByPlatform: true, platformUserId: platformUser.id, platformUserName: platformUser.name },
  });

  res.json(user);
});

// The whole manual-onboarding workflow, callable from the console instead
// of needing server/CLI access.
router.post("/", requirePlatformRole("owner", "onboarding"), async (req, res) => {
  const { shopName, adminEmail, adminName, planTier } = req.body as {
    shopName?: string;
    adminEmail?: string;
    adminName?: string;
    planTier?: string;
  };
  if (!shopName || !adminEmail) {
    return res.status(400).json({ error: "shopName and adminEmail are required" });
  }

  try {
    const result = await provisionShop({ shopName, adminEmail, adminName, planTier });
    res.status(201).json({
      shop: result.shop,
      adminEmail: result.adminEmail,
      adminPassword: result.adminPassword,
    });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

// Issues a short-lived session as the shop's own Admin, for support — every
// use is written to that shop's own AuditLog, not just a platform-side log,
// so a future "who from support touched our account" view is possible.
router.post("/:id/impersonate", requirePlatformRole("owner", "support"), async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop || !shop.active) return res.status(404).json({ error: "Shop not found" });

  const platformUser = await PlatformUser.findById(req.platformAuth!.platformUserId);
  if (!platformUser) return res.status(401).json({ error: "Invalid token" });

  const connection = getShopConnection(shop.id);
  const { User, AuditLog } = getShopModels(connection);
  const adminUser = await User.findOne({ role: "admin", active: true });
  if (!adminUser) return res.status(404).json({ error: "No active admin found for this shop" });

  await AuditLog.create({
    action: "platform_impersonation",
    actorUserId: adminUser._id,
    actorEmail: platformUser.email,
    metadata: { platformUserId: platformUser.id, platformUserName: platformUser.name },
  });

  const token = jwt.sign(
    { type: "shop", userId: adminUser.id, role: adminUser.role, shopId: shop.id },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: { id: adminUser.id, name: adminUser.name, role: adminUser.role },
    shop: { id: shop.id, name: shop.name },
  });
});

// Generates a Stripe-hosted Checkout link for a shop to subscribe to (or
// switch to) a given plan tier — the platform team copies this to send to
// the shop directly, same shape as the customer-portal link generator.
// Nothing on our side is charged or activated until Stripe's webhook
// confirms the checkout actually completed.
router.post("/:id/billing-link", requirePlatformRole("owner", "billing"), async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    return res.status(400).json({ error: "Billing isn't configured yet — set STRIPE_SECRET_KEY on the server." });
  }

  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const { planTier } = req.body as { planTier?: string };
  if (!planTier || !PLAN_TIERS.includes(planTier as PlanTier)) {
    return res.status(400).json({ error: `planTier must be one of: ${PLAN_TIERS.join(", ")}` });
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
    metadata: { shopId: shop.id, planTier },
    subscription_data: { metadata: { shopId: shop.id, planTier } },
    success_url: `${process.env.FRONTEND_URL}/login?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/login?billing=cancelled`,
  });

  res.json({ url: session.url });
});

export default router;
