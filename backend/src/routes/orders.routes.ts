import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import Order from "../models/Order.js";
import StatusLog from "../models/StatusLog.js";
import { EVENTS, getIO } from "../sockets/index.js";

const router = Router();

router.use(requireAuth);

// Front desk/manager/admin create and edit orders; production can view.
router.get("/", requireRole("admin", "manager", "front_desk", "production"), async (_req, res) => {
  res.json(await Order.find().populate("customer"));
});

router.post("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const order = await Order.create({ ...req.body, createdBy: req.auth!.userId });
  res.status(201).json(order);
});

router.patch("/:id", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const existing = await Order.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const previousStatus = existing.status;
  Object.assign(existing, req.body);
  await existing.save();

  if (req.body.status && req.body.status !== previousStatus) {
    await StatusLog.create({
      entityType: "order",
      entityId: existing._id,
      changedBy: req.auth!.userId,
      fromStatus: previousStatus,
      toStatus: existing.status,
    });
    getIO().emit(EVENTS.ORDER_UPDATED, existing);
  }

  res.json(existing);
});

export default router;
