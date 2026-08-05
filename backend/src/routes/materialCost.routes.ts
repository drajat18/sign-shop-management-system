import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { estimateMaterialCost } from "../services/materialPricing.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "manager", "front_desk"));

// Stateless by design — works the same whether the line item has already
// been saved (existing order) or only exists in the new-order form's local
// state (nothing to look up by ID yet).
router.post("/estimate", async (req, res) => {
  const { material, size, quantity } = req.body as {
    material?: string;
    size?: string;
    quantity?: number;
  };
  if (!material || !material.trim()) {
    return res.status(400).json({ error: "material is required" });
  }

  const estimate = estimateMaterialCost({
    material,
    size,
    quantity: quantity && quantity > 0 ? quantity : 1,
  });
  res.json(estimate);
});

export default router;
