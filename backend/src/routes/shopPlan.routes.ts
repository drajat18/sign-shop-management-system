import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Shop from "../models/platform/Shop.js";
import { EMPLOYEE_LIMITS, getShopPlanTier, tierIncludes } from "../services/planLimits.js";
import {
  STORAGE_ADDON_GB,
  getShopStorageLimitBytes,
  getShopStorageUsedBytes,
} from "../services/storageLimits.js";

const router = Router();
router.use(requireAuth);

// One call the frontend uses to gate nav items/buttons up front, instead
// of every gated action just failing with a 403 after the fact. The 403s
// from requirePlanFeature (and the employee-limit check in users.routes.ts)
// stay in place regardless — this is a convenience, not the real gate.
router.get("/", async (req, res) => {
  const planTier = await getShopPlanTier(req.auth!.shopId);
  const [employeeCount, shop, usedBytes, limitBytes] = await Promise.all([
    req.models!.User.countDocuments({ active: true }),
    Shop.findById(req.auth!.shopId).select("subscriptionStatus storageAddons"),
    getShopStorageUsedBytes(req.models!.FileRecord),
    getShopStorageLimitBytes(req.auth!.shopId),
  ]);

  res.json({
    planTier,
    subscriptionStatus: shop?.subscriptionStatus ?? "trialing",
    employeeLimit: EMPLOYEE_LIMITS[planTier],
    employeeCount,
    features: {
      reports: tierIncludes(planTier, "reports"),
      customer_portal: tierIncludes(planTier, "customer_portal"),
      qr_tickets: tierIncludes(planTier, "qr_tickets"),
    },
    storage: {
      usedBytes,
      limitBytes,
      addonUnits: shop?.storageAddons ?? 0,
      addonUnitGb: STORAGE_ADDON_GB,
    },
  });
});

export default router;
