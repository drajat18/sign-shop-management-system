import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { PRICING_METHODS } from "../models/PricingRule.js";

const router = Router();
router.use(requireAuth);

// Anyone who prices an order/quote needs to read the rules (to auto-fill a
// price); only admin/manager can define them, matching who's trusted to set
// pricing policy elsewhere in this app.
router.get("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const rules = await req.models!.PricingRule.find().sort({ signType: 1 });
  res.json(rules);
});

function validateRule(body: Record<string, unknown>): string | null {
  const { signType, method, flatPrice, pricePerSqft, costPlusMarginPercent } = body as {
    signType?: string;
    method?: string;
    flatPrice?: number;
    pricePerSqft?: number;
    costPlusMarginPercent?: number;
  };
  if (!signType?.trim()) return "signType is required";
  if (!method || !PRICING_METHODS.includes(method as (typeof PRICING_METHODS)[number])) {
    return `method must be one of: ${PRICING_METHODS.join(", ")}`;
  }
  if (method === "flat" && typeof flatPrice !== "number") return "flatPrice is required for a flat rule";
  if (method === "per_sqft" && typeof pricePerSqft !== "number") {
    return "pricePerSqft is required for a per_sqft rule";
  }
  if (method === "cost_plus" && typeof costPlusMarginPercent !== "number") {
    return "costPlusMarginPercent is required for a cost_plus rule";
  }
  return null;
}

router.post("/", requireRole("admin", "manager"), async (req, res) => {
  const error = validateRule(req.body as Record<string, unknown>);
  if (error) return res.status(400).json({ error });

  const { signType, method, flatPrice, pricePerSqft, costPlusMarginPercent, minPrice } = req.body as {
    signType: string;
    method: string;
    flatPrice?: number;
    pricePerSqft?: number;
    costPlusMarginPercent?: number;
    minPrice?: number;
  };

  const existing = await req.models!.PricingRule.findOne({ signType: signType.trim() });
  if (existing) return res.status(409).json({ error: "A pricing rule for this sign type already exists" });

  const rule = await req.models!.PricingRule.create({
    signType: signType.trim(),
    method,
    flatPrice,
    pricePerSqft,
    costPlusMarginPercent,
    minPrice,
  });
  res.status(201).json(rule);
});

router.patch("/:id", requireRole("admin", "manager"), async (req, res) => {
  const rule = await req.models!.PricingRule.findById(req.params.id);
  if (!rule) return res.status(404).json({ error: "Pricing rule not found" });

  const merged = { ...rule.toObject(), ...(req.body as Record<string, unknown>) };
  const error = validateRule(merged);
  if (error) return res.status(400).json({ error });

  const { method, flatPrice, pricePerSqft, costPlusMarginPercent, minPrice } = req.body as {
    method?: string;
    flatPrice?: number;
    pricePerSqft?: number;
    costPlusMarginPercent?: number;
    minPrice?: number;
  };
  Object.assign(
    rule,
    Object.fromEntries(
      Object.entries({ method, flatPrice, pricePerSqft, costPlusMarginPercent, minPrice }).filter(
        ([, v]) => v !== undefined
      )
    )
  );
  await rule.save();
  res.json(rule);
});

router.delete("/:id", requireRole("admin", "manager"), async (req, res) => {
  await req.models!.PricingRule.deleteOne({ _id: req.params.id });
  res.status(204).end();
});

export default router;
