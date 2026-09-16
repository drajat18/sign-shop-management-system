import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { consumeMaterialForItem, restockMaterialForItem } from "../services/materialConsumption.js";
import { recomputeOrderTotal } from "../services/orderTotals.js";
import { validateOrderItemFields } from "../utils/validateOrderItem.js";

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
  const { Order, OrderItem } = req.models!;
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const {
    signType,
    size,
    widthIn,
    heightIn,
    material,
    materialStock,
    description,
    quantity,
    price,
    materialCostEstimate,
    materialCostVendor,
  } = req.body as {
    signType?: string;
    size?: string;
    widthIn?: number;
    heightIn?: number;
    material?: string;
    materialStock?: string | null;
    description?: string;
    quantity?: number;
    price?: number;
    materialCostEstimate?: number;
    materialCostVendor?: string;
  };

  // Validated against the merged result, not just whatever fields this
  // particular request happens to touch — a lone {quantity: -5} patch has to
  // be rejected the same as a full item with a negative quantity would be.
  if (signType !== undefined || price !== undefined || quantity !== undefined) {
    const itemError = validateOrderItemFields({
      signType: signType ?? item.signType,
      price: price ?? item.price,
      quantity: quantity ?? item.quantity,
    });
    if (itemError) return res.status(400).json({ error: itemError });
  }

  // Consumption is only real once the item belongs to a committed order —
  // recompute it here whenever quantity, dimensions, or the linked material
  // change, so an edit never leaves stock reflecting stale numbers.
  const consumptionInputsChanged =
    materialStock !== undefined ||
    (quantity !== undefined && quantity !== item.quantity) ||
    (widthIn !== undefined && widthIn !== item.widthIn) ||
    (heightIn !== undefined && heightIn !== item.heightIn);
  // Captured before Object.assign below overwrites them — restocking has to
  // credit whatever material this item *was* consuming, not whatever it's
  // about to be linked to.
  const previousConsumption = { materialStock: item.materialStock, materialConsumedQty: item.materialConsumedQty };

  const patch = Object.fromEntries(
    Object.entries({
      signType,
      size,
      widthIn,
      heightIn,
      material,
      materialStock,
      description,
      quantity,
      price,
      materialCostEstimate,
      materialCostVendor,
    }).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;

  // Only the fields a person actually edits by hand — not the
  // material-linking/cost-lookup bookkeeping fields — are worth an audit
  // trail entry; those move automatically as a side effect of other edits.
  const AUDITED_FIELDS = ["signType", "size", "widthIn", "heightIn", "material", "description", "quantity", "price"];
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of AUDITED_FIELDS) {
    if (field in patch && patch[field] !== (item as unknown as Record<string, unknown>)[field]) {
      changes[field] = { from: (item as unknown as Record<string, unknown>)[field], to: patch[field] };
    }
  }

  Object.assign(item, patch);

  if (consumptionInputsChanged) {
    const order = await Order.findById(item.order);
    await restockMaterialForItem(req.models!, previousConsumption);
    item.materialConsumedQty = 0;
    if (order && order.status !== "quote") {
      item.materialConsumedQty = await consumeMaterialForItem(req.models!, item);
    }
  }

  await item.save();
  await recomputeOrderTotal(req.models!, item.order.toString());

  if (Object.keys(changes).length > 0) {
    await req.models!.AuditLog.create({
      action: "order_item_updated",
      actorUserId: req.auth!.userId,
      targetId: item._id,
      // Stored as a plain string, not the ObjectId itself — metadata is a
      // Mixed field, so Mongoose won't cast a query string to ObjectId for
      // it the way it would for a real typed ref field.
      metadata: { orderId: item.order.toString(), changes },
    });
  }

  res.json(item);
});

// Removing a line item removes the production job that tracks it — there's
// nothing left to produce — and returns whatever material stock it had
// consumed.
router.delete("/:id", async (req, res) => {
  const { OrderItem, ProductionJob } = req.models!;
  const item = await OrderItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  await restockMaterialForItem(req.models!, item);
  await ProductionJob.deleteMany({ orderItem: item._id });
  await item.deleteOne();
  await recomputeOrderTotal(req.models!, item.order.toString());

  res.status(204).end();
});

export default router;
