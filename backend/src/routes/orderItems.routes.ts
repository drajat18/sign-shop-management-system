import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { recomputeOrderTotal } from "../services/orderTotals.js";

const router = Router();

router.use(requireAuth, requireRole("admin", "manager", "front_desk"));

// Every file ever uploaded for this item, newest first — a re-upload no
// longer erases the record of what came before it (see files.routes.ts),
// so a proof-revision dispute has an actual answer instead of "we don't
// know what they approved."
router.get("/:id/files", async (req, res) => {
  const { FileRecord } = req.models!;
  const files = await FileRecord.find({ orderItem: req.params.id })
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "name");
  res.json(files);
});

router.patch("/:id", async (req, res) => {
  const { OrderItem } = req.models!;
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const { signType, size, material, description, quantity, price, materialCostEstimate, materialCostVendor } =
    req.body as {
      signType?: string;
      size?: string;
      material?: string;
      description?: string;
      quantity?: number;
      price?: number;
      materialCostEstimate?: number;
      materialCostVendor?: string;
    };

  Object.assign(
    item,
    Object.fromEntries(
      Object.entries({
        signType,
        size,
        material,
        description,
        quantity,
        price,
        materialCostEstimate,
        materialCostVendor,
      }).filter(([, v]) => v !== undefined)
    )
  );
  await item.save();
  await recomputeOrderTotal(req.models!, item.order.toString());

  res.json(item);
});

// Removing a line item removes the production job that tracks it — there's
// nothing left to produce.
router.delete("/:id", async (req, res) => {
  const { OrderItem, ProductionJob } = req.models!;
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  await ProductionJob.deleteMany({ orderItem: item._id });
  await item.deleteOne();
  await recomputeOrderTotal(req.models!, item.order.toString());

  res.status(204).end();
});

export default router;
