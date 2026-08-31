import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import { getShopConnection } from "../services/shopConnection.js";
import { recomputeOrderPayments } from "../services/orderTotals.js";
import { capturePaypalOrder } from "../services/payments/paypalPayments.js";
import { getSquareOrderState } from "../services/payments/squarePayments.js";
import { verifyChargeLinkToken } from "../services/paymentOAuth/state.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

const router = Router();

function resultRedirect(success: boolean): string {
  return `${process.env.FRONTEND_URL}/payments/result?status=${success ? "success" : "failed"}`;
}

// `reference` is the provider's own id for this specific payment (Square's
// order id, PayPal's order id) — recorded on the Payment so a refreshed or
// re-followed return link never double-counts the same money twice.
async function markOrderPaid(shopId: string, orderId: string, amount: number, reference: string) {
  const models = getShopModels(getShopConnection(shopId));
  const { Order, Payment } = models;
  const order = await Order.findById(orderId);
  if (!order) return;

  const already = await Payment.findOne({ order: order._id, note: reference });
  if (!already) {
    await Payment.create({ order: order._id, amount, method: "online", note: reference });
    await recomputeOrderPayments(models, order.id);
  }

  const updated = await Order.findById(order.id).populate("customer");
  emitToShop(shopId, EVENTS.ORDER_UPDATED, updated);
}

// Square redirects the customer here after checkout — orderId is Square's
// own, appended by Square itself (see checkout_options.redirect_url).
// Confirmed server-side against Square's API rather than trusted as-is,
// since a browser redirect alone doesn't prove the payment captured.
router.get("/square", async (req, res) => {
  const { ourToken, orderId } = req.query as { ourToken?: string; orderId?: string };
  if (!ourToken || !orderId) return res.redirect(resultRedirect(false));

  let decoded;
  try {
    decoded = verifyChargeLinkToken(ourToken);
  } catch {
    return res.redirect(resultRedirect(false));
  }

  const { PaymentConnection } = getShopModels(getShopConnection(decoded.shopId));
  const connection = await PaymentConnection.findOne({ provider: "square" });
  if (!connection?.accessToken) return res.redirect(resultRedirect(false));

  const state = await getSquareOrderState(connection.accessToken, orderId).catch(() => undefined);
  if (state !== "COMPLETED") return res.redirect(resultRedirect(false));

  await markOrderPaid(decoded.shopId, decoded.orderId, decoded.amount, `square:${orderId}`);
  res.redirect(resultRedirect(true));
});

// PayPal's own order id comes back as `token` on its return_url redirect —
// captured here (the authoritative step that actually moves the money)
// rather than assuming approval means payment.
router.get("/paypal", async (req, res) => {
  const { ourToken, token: paypalOrderId } = req.query as { ourToken?: string; token?: string };
  if (!ourToken || !paypalOrderId) return res.redirect(resultRedirect(false));

  let decoded;
  try {
    decoded = verifyChargeLinkToken(ourToken);
  } catch {
    return res.redirect(resultRedirect(false));
  }

  const captured = await capturePaypalOrder(paypalOrderId).catch(() => false);
  if (!captured) return res.redirect(resultRedirect(false));

  await markOrderPaid(decoded.shopId, decoded.orderId, decoded.amount, `paypal:${paypalOrderId}`);
  res.redirect(resultRedirect(true));
});

// PayPal also needs a cancel_url — the customer backed out, nothing to
// confirm.
router.get("/paypal-cancel", (_req, res) => {
  res.redirect(resultRedirect(false));
});

export default router;
