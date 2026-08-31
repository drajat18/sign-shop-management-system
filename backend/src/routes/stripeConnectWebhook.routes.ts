import { Router } from "express";
import type Stripe from "stripe";
import { getShopModels } from "../models/shopModels.js";
import { getStripe, STRIPE_CONFIGURED } from "../services/billing/stripe.js";
import { recomputeOrderPayments } from "../services/orderTotals.js";
import { getShopConnection } from "../services/shopConnection.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

const router = Router();

// Separate from the platform billing webhook (stripeWebhook.routes.ts) —
// Connect events need their own endpoint/secret registered under Stripe's
// Connect webhook settings, since they're scoped to *connected* accounts
// rather than the platform's own account.
router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!STRIPE_CONFIGURED || !signature || !webhookSecret) {
    return res.status(400).json({ error: "Payment webhooks aren't configured." });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const shopId = session.metadata?.shopId;
    const orderId = session.metadata?.orderId;
    if (shopId && orderId) {
      const models = getShopModels(getShopConnection(shopId));
      const { Order, Payment } = models;
      const order = await Order.findById(orderId);
      if (order) {
        const reference = `stripe:${session.id}`;
        const already = await Payment.findOne({ order: order._id, note: reference });
        if (!already) {
          const paidCents = session.amount_total ?? 0;
          await Payment.create({ order: order._id, amount: paidCents / 100, method: "online", note: reference });
          await recomputeOrderPayments(models, order.id);
        }
        const updated = await Order.findById(order.id).populate("customer");
        emitToShop(shopId, EVENTS.ORDER_UPDATED, updated);
      }
    }
  }

  res.json({ received: true });
});

export default router;
