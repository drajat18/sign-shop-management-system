import crypto from "node:crypto";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePlanFeature } from "../middleware/requirePlanFeature.js";
import { requireRole } from "../middleware/requireRole.js";
import { getStripe } from "../services/billing/stripe.js";
import { recomputeOrderTotal } from "../services/orderTotals.js";
import { createPaypalOrder } from "../services/payments/paypalPayments.js";
import { createSquarePaymentLink, withSquareAutoRefresh } from "../services/payments/squarePayments.js";
import { paymentBackendUrl, signChargeLinkToken } from "../services/paymentOAuth/state.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

function paymentReturnBaseUrl(): string {
  return `${paymentBackendUrl()}/api/payment-return`;
}

const PORTAL_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

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
router.get("/", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const { Order, OrderItem } = req.models!;
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

  const shopId = req.auth!.shopId;
  const populatedOrder = { ...order.toJSON(), customer: customer.toJSON(), itemsCount: orderItems.length };
  emitToShop(shopId, EVENTS.ORDER_CREATED, populatedOrder);
  for (const job of jobs) {
    emitToShop(shopId, EVENTS.JOB_CREATED, job.toJSON());
  }

  res.status(201).json({ order: populatedOrder, items: orderItems, jobs });
});

// Adds one more line item to an order that's already been placed, with its
// own production job — used by the order edit view's "add item" control.
router.post("/:id/items", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, OrderItem, ProductionJob } = req.models!;
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
  await recomputeOrderTotal(req.models!, order.id);

  emitToShop(req.auth!.shopId, EVENTS.JOB_CREATED, job.toJSON());
  res.status(201).json({ item, job });
});

router.patch("/:id", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { Order, StatusLog } = req.models!;
  const existing = await Order.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const { status, dueDate, paymentStatus, description, customerComment, customerResponseType } = req.body as {
    status?: string;
    dueDate?: string;
    paymentStatus?: string;
    description?: string;
    customerComment?: string;
    customerResponseType?: string;
  };

  const previousStatus = existing.status;
  Object.assign(
    existing,
    Object.fromEntries(
      Object.entries({ status, dueDate, paymentStatus, description, customerComment, customerResponseType }).filter(
        ([, v]) => v !== undefined
      )
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
  }
  // Populated before emitting — other open tabs merge this straight into
  // their order list state (see OrdersPage's socket handler), so an
  // unpopulated customer ref would blank out the customer name there.
  await existing.populate("customer");
  // Emitted unconditionally (not just on status change) so other open tabs —
  // notably the Production page, which shows a customer-response badge —
  // pick up edits like a staff member dismissing that badge.
  emitToShop(req.auth!.shopId, EVENTS.ORDER_UPDATED, existing);

  res.json(existing);
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

export default router;
