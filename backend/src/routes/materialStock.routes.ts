import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth);

// Front desk can see stock levels (useful while quoting/taking an order)
// but only admin/manager can actually manage inventory.
router.get("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { MaterialStock } = req.models!;
  res.json(await MaterialStock.find().sort({ materialName: 1 }));
});

router.post("/", requireRole("admin", "manager"), async (req, res) => {
  const { materialName, unit, quantityOnHand, reorderThreshold, notes, vendorName, vendorContact, leadTimeDays } =
    req.body as {
      materialName?: string;
      unit?: string;
      quantityOnHand?: number;
      reorderThreshold?: number;
      notes?: string;
      vendorName?: string;
      vendorContact?: string;
      leadTimeDays?: number;
    };
  if (!materialName?.trim()) {
    return res.status(400).json({ error: "materialName is required" });
  }

  const { MaterialStock } = req.models!;
  const stock = await MaterialStock.create({
    materialName: materialName.trim(),
    unit: unit?.trim() || "each",
    quantityOnHand: quantityOnHand ?? 0,
    reorderThreshold: reorderThreshold ?? 0,
    notes,
    vendorName,
    vendorContact,
    leadTimeDays,
  });
  res.status(201).json(stock);
});

router.patch("/:id", requireRole("admin", "manager"), async (req, res) => {
  const { MaterialStock } = req.models!;
  const stock = await MaterialStock.findById(req.params.id);
  if (!stock) return res.status(404).json({ error: "Material not found" });

  const { materialName, unit, quantityOnHand, reorderThreshold, notes, vendorName, vendorContact, leadTimeDays } =
    req.body as {
      materialName?: string;
      unit?: string;
      quantityOnHand?: number;
      reorderThreshold?: number;
      notes?: string;
      vendorName?: string;
      vendorContact?: string;
      leadTimeDays?: number;
    };

  Object.assign(
    stock,
    Object.fromEntries(
      Object.entries({
        materialName,
        unit,
        quantityOnHand,
        reorderThreshold,
        notes,
        vendorName,
        vendorContact,
        leadTimeDays,
      }).filter(([, v]) => v !== undefined)
    )
  );
  await stock.save();
  res.json(stock);
});

router.delete("/:id", requireRole("admin", "manager"), async (req, res) => {
  const { MaterialStock } = req.models!;
  const stock = await MaterialStock.findById(req.params.id);
  if (!stock) return res.status(404).json({ error: "Material not found" });
  await stock.deleteOne();
  res.status(204).end();
});

export default router;
