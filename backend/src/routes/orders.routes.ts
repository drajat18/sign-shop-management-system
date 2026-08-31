import crypto from "node:crypto";
import { Router } from "express";
import type { Document } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requirePlanFeature } from "../middleware/requirePlanFeature.js";
import { requireRole } from "../middleware/requireRole.js";
import type { Customer } from "../models/Customer.js";
import { PAYMENT_METHODS } from "../models/Payment.js";
import { getStripe } from "../services/billing/stripe.js";
import { notifyCustomer } from "../services/notifications.js";
import { recomputeOrderPayments, recomputeOrderTotal } from "../services/orderTotals.js";
import { createPaypalOrder } from "../services/payments/paypalPayments.js";
import { createSquarePaymentLink, withSquareAutoRefresh } from "../services/payments/squarePayments.js";
import { paymentBackendUrl, signChargeLinkToken } from "../services/paymentOAuth/state.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

function paymentReturnBaseUrl(): string {
  return `${paymentBackendUrl()}/api/payment-return`;
}

type CustomerDoc = Document & Customer;

const PORTAL_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface NewOrderItem {
  signType: string;
  size?: string;
  material?: string;
  description?: string;
  quantity?: number;
  price: number;
  materialCostEstimate?: number;
  materialCostVendor?: string;
}

const router = Router();

router.use(requireAuth);

const SORTABLE_FIELDS = ["createdAt", "dueDate", "total", "status", "paymentStatus", "installDate"] as const;

// Front desk/manager/admin create and edit orders; production can view
// (they need the customer/due-date context behind each job they're assigned).
// Search/filter/sort/paginate all happen server-side rather than shipping
// every order to the client — the only one that needs a pre-pass is
// `search`, since matching by customer name means resolving customer ids
// before the Order query can filter on them (Mongo can't filter a find()
// by a populated ref's own fields directly).
router.get("/", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const { Order, OrderItem, OrderMessage, Customer } = req.models!;
  const {
    search,
    status,
    paymentStatus,
    installRequired,
    sortBy = "createdAt",
    sortDir = "desc",
    page = "1",
    limit = "25",
  } = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (installRequired === "true") filter.installRequired = true;
  if (search?.trim()) {
    const matchingCustomers = await Customer.find({
      name: { $regex: search.trim(), $options: "i" },
    }).select("_id");
    filter.customer = { $in: matchingCustomers.map((c) => c._id) };
  }

  const sortField = (SORTABLE_FIELDS as readonly string[]).includes(sortBy ?? "") ? sortBy! : "createdAt";
  const sortOrder = sortDir === "asc" ? 1 : -1;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "25", 10) || 25));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer")
      .sort({ [sortField]: sortOrder })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Order.countDocuments(filter),
  ]);

  const orderIds = orders.map((o) => o._id);
  const counts = await OrderItem.aggregate([
    { $match: { order: { $in: orderIds } } },
    { $group: { _id: "$order", count: { $sum: 1 } } },
  ]);
  const countByOrder = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const unread = await OrderMessage.aggregate([
    { $match: { order: { $in: orderIds }, sender: "customer", readByStaff: false } },
    { $group: { _id: "$order", count: { $sum: 1 } } },
  ]);
  const unreadByOrder = new Map(unread.map((c) => [c._id.toString(), c.count]));

  res.json({
    orders: orders.map((order) => ({
      ...order.toJSON(),
      itemsCount: countByOrder.get(order.id) ?? 0,
      unreadMessageCount: unreadByOrder.get(order.id) ?? 0,
    })),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

// CSV export of every order matching the current filters (no pagination
// limit, unlike the list endpoint) — registered ahead of GET /:id so
// "export" is never swallowed as an :id value.
router.get("/export", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, Customer } = req.models!;
  const { search, status, paymentStatus, from, to } = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    filter.createdAt = createdAt;
  }
  if (search?.trim()) {
    const matchingCustomers = await Customer.find({
      name: { $regex: search.trim(), $options: "i" },
    }).select("_id");
    filter.customer = { $in: matchingCustomers.map((c) => c._id) };
  }

  const orders = await Order.find(filter).populate("customer").sort({ createdAt: -1 });

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  // Accounting-ready: a bookkeeper can reconcile this against real deposits
  // without cross-referencing the app — items/install broken out, and
  // balance due computed from the real payment ledger, not just a label.
  const header = [
    "Order ID",
    "Customer",
    "Created At",
    "Due Date",
    "Status",
    "Items Subtotal",
    "Install Charge",
    "Total",
    "Amount Paid",
    "Balance Due",
    "Payment Status",
  ];
  const rows = orders.map((order) => {
    const installCharge = order.installRequired ? order.installCharge ?? 0 : 0;
    const amountPaid = order.amountPaid ?? 0;
    return [
      order.id,
      (order.customer as unknown as { name?: string } | null)?.name ?? "",
      new Date(order.get("createdAt")).toLocaleDateString(),
      order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "",
      order.status,
      (order.total - installCharge).toFixed(2),
      installCharge.toFixed(2),
      order.total.toFixed(2),
      amountPaid.toFixed(2),
      (order.total - amountPaid).toFixed(2),
      order.paymentStatus,
    ];
  });
  const csv = [header, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="orders.csv"');
  res.send(csv);
});

// Full detail: everything needed to view or edit an order, including each
// item's current production job status — this is what backs the "view
// order" link from the Production page as well as the Orders list.
router.get("/:id", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const { Order, OrderItem, ProductionJob } = req.models!;
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
  const { Customer, Order, OrderItem, ProductionJob } = req.models!;
  const {
    customerId,
    newCustomer,
    dueDate,
    description,
    installRequired,
    installAddress,
    installCharge,
    installDate,
    items,
  } = req.body as {
    customerId?: string;
    newCustomer?: { name: string; email?: string; phone?: string };
    dueDate?: string;
    description?: string;
    installRequired?: boolean;
    installAddress?: string;
    installCharge?: number;
    installDate?: string;
    items: NewOrderItem[];
  };

  if (!customerId && !newCustomer?.name) {
    return res.status(400).json({ error: "customerId or newCustomer.name is required" });
  }
  if (!dueDate) {
    return res.status(400).json({ error: "Due date is required" });
  }
  if (!items?.length) {
    return res.status(400).json({ error: "At least one line item is required" });
  }
  for (const item of items) {
    if (!item.signType || typeof item.price !== "number") {
      return res.status(400).json({ error: "Each item needs a signType and a numeric price" });
    }
  }
  if (installRequired && !installAddress?.trim()) {
    return res.status(400).json({ error: "Installation address is required when installation is needed" });
  }

  const customer = customerId
    ? await Customer.findById(customerId)
    : await Customer.create(newCustomer);
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const resolvedInstallCharge = installRequired ? installCharge ?? 0 : 0;
  const total =
    items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0) + resolvedInstallCharge;

  const order = await Order.create({
    customer: customer._id,
    dueDate,
    description,
    installRequired: Boolean(installRequired),
    installAddress: installRequired ? installAddress : undefined,
    installCharge: resolvedInstallCharge,
    installDate: installRequired ? installDate || undefined : undefined,
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
      materialCostEstimate: item.materialCostEstimate,
      materialCostVendor: item.materialCostVendor,
    }))
  );

  const jobs = await ProductionJob.insertMany(
    orderItems.map((item) => ({ orderItem: item._id, status: "queued" }))
  );

  const shopId = req.auth!.shopId;
  const populatedOrder = { ...order.toJSON(), customer: customer.toJSON(), itemsCount: orderItems.length };
  emitToShop(shopId, EVENTS.ORDER_CREATED, populatedOrder);
  for (const job of jobs) {
    emitToShop(shopId, EVENTS.JOB_CREATED, job.toJSON());
  }

  const itemCount = orderItems.length;
  void notifyCustomer(req.models!, shopId, order, customer, {
    subject: "Order confirmed",
    text: `Hi! We've received your order — ${itemCount} item${itemCount === 1 ? "" : "s"}, total $${total.toFixed(2)}.${
      dueDate ? ` Expected by ${new Date(dueDate).toLocaleDateString()}.` : ""
    } We'll keep you updated as it moves through production.`,
    trigger: "order_created",
  });

  res.status(201).json({ order: populatedOrder, items: orderItems, jobs });
});

// Adds one more line item to an order that's already been placed, with its
// own production job — used by the order edit view's "add item" control.
router.post("/:id/items", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, OrderItem, ProductionJob } = req.models!;
  const order = await Order.findById(req.params.id).populate("customer");
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { signType, size, material, description, quantity, price, materialCostEstimate, materialCostVendor } =
    req.body as NewOrderItem;
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
    materialCostEstimate,
    materialCostVendor,
  });
  const job = await ProductionJob.create({ orderItem: item._id, status: "queued" });
  await recomputeOrderTotal(req.models!, order.id);

  emitToShop(req.auth!.shopId, EVENTS.JOB_CREATED, job.toJSON());

  // recomputeOrderTotal writes straight to the DB rather than mutating
  // `order`, so the item count + total here need a fresh read to reflect
  // the item we just added.
  const [itemCount, updatedOrder] = await Promise.all([
    OrderItem.countDocuments({ order: order._id }),
    Order.findById(order._id),
  ]);
  void notifyCustomer(
    req.models!,
    req.auth!.shopId,
    order,
    order.customer as unknown as CustomerDoc,
    {
      subject: "A new item was added to your order",
      text: `Hi! We've added "${signType}" to your order. It now has ${itemCount} item${
        itemCount === 1 ? "" : "s"
      }, total $${(updatedOrder?.total ?? 0).toFixed(2)}.`,
      trigger: "order_item_added",
    }
  );

  res.status(201).json({ item, job });
});

// Registered ahead of PATCH /:id so "bulk" is never swallowed as an :id
// value — Express matches routes in registration order.
router.patch("/bulk", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, StatusLog } = req.models!;
  const { orderIds, status, paymentStatus } = req.body as {
    orderIds?: string[];
    status?: string;
    paymentStatus?: string;
  };
  if (!orderIds?.length) {
    return res.status(400).json({ error: "orderIds is required" });
  }
  if (!status && !paymentStatus) {
    return res.status(400).json({ error: "status or paymentStatus is required" });
  }

  let updated = 0;
  for (const orderId of orderIds) {
    const existing = await Order.findById(orderId);
    if (!existing) continue;

    const previousStatus = existing.status;
    if (status) existing.status = status as (typeof existing)["status"];
    if (paymentStatus) existing.paymentStatus = paymentStatus as (typeof existing)["paymentStatus"];
    await existing.save();
    updated += 1;

    if (status && status !== previousStatus) {
      await StatusLog.create({
        entityType: "order",
        entityId: existing._id,
        changedBy: req.auth!.userId,
        fromStatus: previousStatus,
        toStatus: existing.status,
      });
    }

    await existing.populate("customer");
    emitToShop(req.auth!.shopId, EVENTS.ORDER_UPDATED, existing);

    if (status && status !== previousStatus) {
      const label = status.replace("_", " ");
      void notifyCustomer(
        req.models!,
        req.auth!.shopId,
        existing,
        existing.customer as unknown as CustomerDoc,
        {
          subject: `Your order is now: ${label}`,
          text: `Hi! Just a quick update — your order's status changed to "${label}".`,
          trigger: "order_status_changed",
        }
      );
    }
  }

  res.json({ updated });
});

router.patch("/:id", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, StatusLog } = req.models!;
  const existing = await Order.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const {
    status,
    dueDate,
    paymentStatus,
    description,
    installRequired,
    installAddress,
    installCharge,
    installDate,
  } = req.body as {
    status?: string;
    dueDate?: string;
    paymentStatus?: string;
    description?: string;
    installRequired?: boolean;
    installAddress?: string;
    installCharge?: number;
    installDate?: string | null;
  };

  if (installRequired && !(installAddress ?? existing.installAddress)?.trim()) {
    return res.status(400).json({ error: "Installation address is required when installation is needed" });
  }

  const previousStatus = existing.status;
  const previousDueDateTime = existing.dueDate ? new Date(existing.dueDate).getTime() : undefined;
  const totalNeedsRecompute =
    (installRequired !== undefined && installRequired !== existing.installRequired) ||
    (installCharge !== undefined && installCharge !== existing.installCharge);
  Object.assign(
    existing,
    Object.fromEntries(
      Object.entries({
        status,
        dueDate,
        paymentStatus,
        description,
        installRequired,
        installAddress: installRequired === false ? "" : installAddress,
        installCharge,
        installDate: installRequired === false ? null : installDate,
      }).filter(([, v]) => v !== undefined)
    )
  );
  if (totalNeedsRecompute) {
    const { OrderItem } = req.models!;
    const items = await OrderItem.find({ order: existing._id });
    const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    existing.total = itemsTotal + (existing.installRequired ? existing.installCharge ?? 0 : 0);
  }
  await existing.save();

  if (status && status !== previousStatus) {
    await StatusLog.create({
      entityType: "order",
      entityId: existing._id,
      changedBy: req.auth!.userId,
      fromStatus: previousStatus,
      toStatus: existing.status,
    });
  }
  // Populated before emitting — other open tabs merge this straight into
  // their order list state (see OrdersPage's socket handler), so an
  // unpopulated customer ref would blank out the customer name there.
  await existing.populate("customer");
  // Emitted unconditionally (not just on status change) so other open tabs —
  // notably the Production page, which shows a customer-response badge —
  // pick up edits like a staff member dismissing that badge.
  emitToShop(req.auth!.shopId, EVENTS.ORDER_UPDATED, existing);

  if (status && status !== previousStatus) {
    const label = status.replace("_", " ");
    void notifyCustomer(
      req.models!,
      req.auth!.shopId,
      existing,
      existing.customer as unknown as CustomerDoc,
      {
        subject: `Your order is now: ${label}`,
        text: `Hi! Just a quick update — your order's status changed to "${label}".`,
        trigger: "order_status_changed",
      }
    );
  }

  const newDueDateTime = existing.dueDate ? new Date(existing.dueDate).getTime() : undefined;
  if (dueDate !== undefined && newDueDateTime !== previousDueDateTime) {
    void notifyCustomer(
      req.models!,
      req.auth!.shopId,
      existing,
      existing.customer as unknown as CustomerDoc,
      {
        subject: "Your order's due date changed",
        text: `Hi! Just a quick update — your order's due date is now ${new Date(
          existing.dueDate!
        ).toLocaleDateString()}.`,
        trigger: "order_due_date_changed",
      }
    );
  }

  res.json(existing);
});

// Loading the thread is what "reading" it means — clears the unread flag
// on every pending customer message plus the Order's own attention flag,
// exactly once, instead of needing a separate "dismiss" action that used
// to erase the message itself along with it.
router.get("/:id/messages", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, OrderMessage } = req.models!;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const messages = await OrderMessage.find({ order: order._id })
    .sort({ createdAt: 1 })
    .populate("staffUser", "name");

  await OrderMessage.updateMany(
    { order: order._id, sender: "customer", readByStaff: false },
    { readByStaff: true }
  );
  if (order.customerResponseType) {
    order.customerResponseType = undefined;
    await order.save();
  }

  res.json(messages);
});

router.post("/:id/messages", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, OrderMessage } = req.models!;
  const order = await Order.findById(req.params.id).populate("customer");
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { body } = req.body as { body?: string };
  if (!body?.trim()) return res.status(400).json({ error: "A message is required" });

  const message = await OrderMessage.create({
    order: order._id,
    sender: "staff",
    staffUser: req.auth!.userId,
    body: body.trim(),
    readByStaff: true,
  });
  await message.populate("staffUser", "name");

  emitToShop(req.auth!.shopId, EVENTS.ORDER_MESSAGE_CREATED, { orderId: order.id, message });

  void notifyCustomer(req.models!, req.auth!.shopId, order, order.customer as unknown as CustomerDoc, {
    subject: "New message about your order",
    text: body.trim(),
    trigger: "staff_message",
  });

  res.status(201).json(message);
});

// Returns a shareable customer-portal link for this order, creating one if
// none exists yet (or the previous one expired). Reusing the same link on
// repeat calls means re-copying it for the customer never breaks a copy
// they may have already bookmarked.
router.post(
  "/:id/portal-link",
  requireRole("admin", "manager", "front_desk"),
  requirePlanFeature("customer_portal"),
  async (req, res) => {
    const { Order, CustomerPortalToken } = req.models!;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    let tokenRecord = await CustomerPortalToken.findOne({
      order: order._id,
      expiresAt: { $gt: new Date() },
    });
    if (!tokenRecord) {
      tokenRecord = await CustomerPortalToken.create({
        order: order._id,
        token: crypto.randomBytes(24).toString("base64url"),
        expiresAt: new Date(Date.now() + PORTAL_LINK_TTL_MS),
      });
    }

    res.json({ url: `${process.env.FRONTEND_URL}/portal/${req.auth!.shopId}/${tokenRecord.token}` });
  }
);

// Returns a payment link for this order, charged through the shop's own
// connected payment processor — the platform never touches this money.
// Falls back to a dummy payment link when the shop's connection is still
// a test one, same "configured vs connected" split used everywhere else
// in this app's integrations. Whichever processor a shop has connected
// (Stripe, Square, or PayPal) is the one used here — a shop only ever
// has one live at a time in practice.
router.post("/:id/charge-link", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, PaymentConnection } = req.models!;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { amount } = req.body as { amount?: number };
  const chargeAmount = typeof amount === "number" && amount > 0 ? amount : order.total;
  const shopId = req.auth!.shopId;

  const connection = await PaymentConnection.findOne();
  if (!connection) {
    return res
      .status(400)
      .json({ error: "Connect a payment processor in Settings before charging a customer." });
  }

  if (connection.connectedAccountId.startsWith("dummy_acct_")) {
    const token = signChargeLinkToken({ shopId, orderId: order.id, amount: chargeAmount });
    return res.json({ url: `${process.env.FRONTEND_URL}/payments/dummy-charge/${token}`, mode: "dummy" });
  }

  if (connection.provider === "stripe") {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(chargeAmount * 100),
              product_data: { name: "Order payment" },
            },
            quantity: 1,
          },
        ],
        metadata: { shopId, orderId: order.id },
        success_url: `${process.env.FRONTEND_URL}/login?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL}/login?payment=cancelled`,
      },
      { stripeAccount: connection.connectedAccountId }
    );
    return res.json({ url: session.url, mode: "stripe" });
  }

  const ourToken = signChargeLinkToken({ shopId, orderId: order.id, amount: chargeAmount });

  if (connection.provider === "square") {
    if (!connection.accessToken || !connection.refreshToken) {
      return res.status(400).json({ error: "This shop's Square connection is missing an access token." });
    }
    const redirectUrl = `${paymentReturnBaseUrl()}/square?ourToken=${ourToken}`;
    const url = await withSquareAutoRefresh(
      connection.accessToken,
      connection.refreshToken,
      async (freshToken) => {
        connection.accessToken = freshToken;
        await connection.save();
      },
      (token) => createSquarePaymentLink(token, chargeAmount, redirectUrl)
    );
    return res.json({ url, mode: "square" });
  }

  // paypal
  const url = await createPaypalOrder(
    connection.connectedAccountId,
    chargeAmount,
    `${paymentReturnBaseUrl()}/paypal?ourToken=${ourToken}`,
    `${paymentReturnBaseUrl()}/paypal-cancel`
  );
  res.json({ url, mode: "paypal" });
});

// The actual money ledger for an order — what a charge link produces once
// completed, and what "Record payment" writes for cash/card/check taken at
// the counter. Both land here so paymentStatus and A/R reporting reflect
// real dollars either way.
router.get("/:id/payments", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Payment } = req.models!;
  const payments = await Payment.find({ order: req.params.id })
    .sort({ createdAt: -1 })
    .populate("recordedBy", "name");
  res.json(payments);
});

router.post("/:id/payments", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, Payment } = req.models!;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { amount, method, note } = req.body as { amount?: number; method?: string; note?: string };
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!method || !PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    return res.status(400).json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` });
  }

  const payment = await Payment.create({
    order: order._id,
    amount,
    method,
    note,
    recordedBy: req.auth!.userId,
  });
  await recomputeOrderPayments(req.models!, order.id);
  const updatedOrder = await Order.findById(order.id).populate("customer");
  emitToShop(req.auth!.shopId, EVENTS.ORDER_UPDATED, updatedOrder);

  res.status(201).json(payment);
});

export default router;
