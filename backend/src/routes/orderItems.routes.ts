import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import OrderItem from "../models/OrderItem.js";
import ProductionJob from "../models/ProductionJob.js";
import { recomputeOrderTotal } from "../services/orderTotals.js";

const router = Router();

router.use(requireAuth, requireRole("admin", "manager", "front_desk"));

router.patch("/:id", async (req, res) => {
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const { signType, size, material, description, quantity, price } = req.body as {
    signType?: string;
    size?: string;
    material?: string;
    description?: string;
    quantity?: number;
    price?: number;
  };

  Object.assign(
    item,
    Object.fromEntries(
      Object.entries({ signType, size, material, description, quantity, price }).filter(
        ([, v]) => v !== undefined
      )
    )
  );
  await item.save();
  await recomputeOrderTotal(item.order.toString());

  res.json(item);
});

// Removing a line item removes the production job that tracks it — there's
// nothing left to produce.
router.delete("/:id", async (req, res) => {
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  await ProductionJob.deleteMany({ orderItem: item._id });
  await item.deleteOne();
  await recomputeOrderTotal(item.order.toString());

  res.status(204).end();
});

export default router;
