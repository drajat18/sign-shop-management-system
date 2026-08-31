import crypto from "node:crypto";
import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import { recomputeOrderPayments } from "../services/orderTotals.js";
import { getShopConnection } from "../services/shopConnection.js";
import {
  verifyChargeLinkToken,
  verifyPaymentConnectState,
} from "../services/paymentOAuth/state.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

const router = Router();

// Stand-ins for real Stripe Connect / Checkout, reachable only when the
// platform hasn't configured Connect yet (see settingsPayments.routes.ts)
// or a shop is still on its dummy connection — mirrors the billing dummy
// provider's role exactly, one phase later in the money flow.

router.get("/dummy-connect/:token", async (req, res) => {
  let decoded;
  try {
    decoded = verifyPaymentConnectState(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }
  const shop = await Shop.findById(decoded.shopId);
  if (!shop) return res.status(404).json({ error: "This link is invalid or has expired." });
  res.json({ shopName: shop.name, provider: decoded.provider });
});

router.post("/dummy-connect/:token/complete", async (req, res) => {
  let decoded;
  try {
    decoded = verifyPaymentConnectState(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }

  const accountId = `dummy_acct_${crypto.randomUUID()}`;
  const { PaymentConnection } = getShopModels(getShopConnection(decoded.shopId));
  await PaymentConnection.findOneAndUpdate(
    { provider: decoded.provider },
    {
      provider: decoded.provider,
      connectedAccountId: accountId,
      accountLabel: accountId,
      connectedBy: decoded.userId,
    },
    { upsert: true }
  );
  res.json({ message: "Test payment account connected." });
});

router.get("/dummy-charge/:token", async (req, res) => {
  let decoded;
  try {
    decoded = verifyChargeLinkToken(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }
  const { Order, Customer } = getShopModels(getShopConnection(decoded.shopId));
  const order = await Order.findById(decoded.orderId);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });
  const customer = await Customer.findById(order.customer);

  res.json({
    customerName: customer?.name,
    orderTotal: order.total,
    amount: decoded.amount,
    paymentStatus: order.paymentStatus,
  });
});

router.post("/dummy-charge/:token/complete", async (req, res) => {
  let decoded;
  try {
    decoded = verifyChargeLinkToken(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }
  const models = getShopModels(getShopConnection(decoded.shopId));
  const { Order, Payment } = models;
  const order = await Order.findById(decoded.orderId);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });

  const reference = `dummy:${req.params.token}`;
  const already = await Payment.findOne({ order: order._id, note: reference });
  if (!already) {
    await Payment.create({ order: order._id, amount: decoded.amount, method: "online", note: reference });
    await recomputeOrderPayments(models, order.id);
  }
  const updated = await Order.findById(order.id).populate("customer");
  emitToShop(decoded.shopId, EVENTS.ORDER_UPDATED, updated);

  res.json({ message: "Test payment received — thank you!" });
});

export default router;
