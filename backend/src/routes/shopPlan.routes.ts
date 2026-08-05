import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { EMPLOYEE_LIMITS, getShopPlanTier, tierIncludes } from "../services/planLimits.js";

const router = Router();
router.use(requireAuth);

// One call the frontend uses to gate nav items/buttons up front, instead
// of every gated action just failing with a 403 after the fact. The 403s
// from requirePlanFeature (and the employee-limit check in users.routes.ts)
// stay in place regardless — this is a convenience, not the real gate.
router.get("/", async (req, res) => {
  const planTier = await getShopPlanTier(req.auth!.shopId);
  const employeeCount = await req.models!.User.countDocuments({ active: true });

  res.json({
    planTier,
    employeeLimit: EMPLOYEE_LIMITS[planTier],
    employeeCount,
    features: {
      reports: tierIncludes(planTier, "reports"),
      customer_portal: tierIncludes(planTier, "customer_portal"),
      qr_tickets: tierIncludes(planTier, "qr_tickets"),
    },
  });
});

export default router;
