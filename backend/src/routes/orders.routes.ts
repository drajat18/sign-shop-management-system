import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import ProductionJob from "../models/ProductionJob.js";
import StatusLog from "../models/StatusLog.js";
import { recomputeOrderTotal } from "../services/orderTotals.js";
import { EVENTS, getIO } from "../sockets/index.js";

interface NewOrderItem {
  signType: string;
  size?: string;
  material?: string;
  description?: string;
  quantity?: number;
  price: number;
}

const router = Router();

router.use(requireAuth);

// Front desk/manager/admin create and edit orders; production can view
// (they need the customer/due-date context behind each job they're assigned).
router.get("/", requireRole("admin", "manager", "front_desk", "production"), async (_req, res) => {
  const orders = await Order.find().populate("customer").sort({ createdAt: -1 });
  const counts = await OrderItem.aggregate([{ $group: { _id: "$order", count: { $sum: 1 } } }]);
  const countByOrder = new Map(counts.map((c) => [c._id.toString(), c.count]));

  res.json(
    orders.map((order) => ({
      ...order.toJSON(),
      itemsCount: countByOrder.get(order.id) ?? 0,
    }))
  );
});

// Full detail: everything needed to view or edit an order, including each
// item's current production job status — this is what backs the "view
// order" link from the Production page as well as the Orders list.
router.get("/:id", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const order = await Order.findById(req.params.id).populate("customer");
  if (!order) return res.status(404).json({ error: "Order not found" });

  const items = await OrderItem.find({ order: order._id }).populate("artworkFile");
  const jobs = await ProductionJob.find({ orderItem: { $in: items.map((i) => i._id) } }).populate(
    "assignedTo",
    "name"
  );
  const jobByItem = new Map(jobs.map((j) => [j.orderItem.toString(), j]));

  res.json({
    ...order.toJSON(),
    items: items.map((item) => ({ ...item.toJSON(), job: jobByItem.get(item.id) ?? null })),
  });
});

// Creates the order, its line items, and one queued production job per
// item in a single call — that's what makes a placed order actually show
// up on the Production page instead of orders and jobs living in silos.
router.post("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { customerId, newCustomer, dueDate, description, items } = req.body as {
    customerId?: string;
    newCustomer?: { name: string; email?: string; phone?: string };
    dueDate?: string;
    description?: string;
    items: NewOrderItem[];
  };

  if (!customerId && !newCustomer?.name) {
    return res.status(400).json({ error: "customerId or newCustomer.name is required" });
  }
  if (!items?.length) {
    return res.status(400).json({ error: "At least one line item is required" });
  }
  for (const item of items) {
    if (!item.signType || typeof item.price !== "number") {
      return res.status(400).json({ error: "Each item needs a signType and a numeric price" });
    }
  }

  const customer = customerId
    ? await Customer.findById(customerId)
    : await Customer.create(newCustomer);
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const total = items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0);

  const order = await Order.create({
    customer: customer._id,
    dueDate,
    description,
    total,
    createdBy: req.auth!.userId,
  });

  const orderItems = await OrderItem.insertMany(
    items.map((item) => ({
      order: order._id,
      signType: item.signType,
      size: item.size,
      material: item.material,
      description: item.description,
      quantity: item.quantity ?? 1,
      price: item.price,
    }))
  );

  const jobs = await ProductionJob.insertMany(
    orderItems.map((item) => ({ orderItem: item._id, status: "queued" }))
  );

  const io = getIO();
  const populatedOrder = { ...order.toJSON(), customer: customer.toJSON(), itemsCount: orderItems.length };
  io.emit(EVENTS.ORDER_CREATED, populatedOrder);
  for (const job of jobs) {
    io.emit(EVENTS.JOB_CREATED, job.toJSON());
  }

  res.status(201).json({ order: populatedOrder, items: orderItems, jobs });
});

// Adds one more line item to an order that's already been placed, with its
// own production job — used by the order edit view's "add item" control.
router.post("/:id/items", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { signType, size, material, description, quantity, price } = req.body as NewOrderItem;
  if (!signType || typeof price !== "number") {
    return res.status(400).json({ error: "signType and a numeric price are required" });
  }

  const item = await OrderItem.create({
    order: order._id,
    signType,
    size,
    material,
    description,
    quantity: quantity ?? 1,
    price,
  });
  const job = await ProductionJob.create({ orderItem: item._id, status: "queued" });
  await recomputeOrderTotal(order.id);

  getIO().emit(EVENTS.JOB_CREATED, job.toJSON());
  res.status(201).json({ item, job });
});

router.patch("/:id", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const existing = await Order.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const { status, dueDate, paymentStatus, description } = req.body as {
    status?: string;
    dueDate?: string;
    paymentStatus?: string;
    description?: string;
  };

  const previousStatus = existing.status;
  Object.assign(
    existing,
    Object.fromEntries(
      Object.entries({ status, dueDate, paymentStatus, description }).filter(([, v]) => v !== undefined)
    )
  );
  await existing.save();

  if (status && status !== previousStatus) {
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
