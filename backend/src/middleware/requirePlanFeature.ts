import type { NextFunction, Request, Response } from "express";
import { getShopPlanTier, tierIncludes, type GatedFeature } from "../services/planLimits.js";

const FEATURE_LABEL: Record<GatedFeature, string> = {
  reports: "Reports",
  customer_portal: "the customer portal",
  qr_tickets: "QR job tickets",
};

export function requirePlanFeature(feature: GatedFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const planTier = await getShopPlanTier(req.auth!.shopId);
    if (!tierIncludes(planTier, feature)) {
      return res.status(403).json({
        error: `${FEATURE_LABEL[feature]} requires the Growth plan or higher. This shop is on Starter.`,
        upgradeRequired: true,
      });
    }
    next();
  };
}
