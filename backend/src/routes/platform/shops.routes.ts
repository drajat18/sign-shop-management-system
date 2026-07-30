import { Router } from "express";
import jwt from "jsonwebtoken";
import { requirePlatformAuth } from "../../middleware/platformAuth.js";
import { requirePlatformRole } from "../../middleware/requirePlatformRole.js";
import { getShopModels } from "../../models/shopModels.js";
import PlatformUser from "../../models/platform/PlatformUser.js";
import Shop from "../../models/platform/Shop.js";
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

export default router;
