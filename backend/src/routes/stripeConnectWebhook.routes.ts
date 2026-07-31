import { Router } from "express";
import type Stripe from "stripe";
import { getShopModels } from "../models/shopModels.js";
import { getStripe, STRIPE_CONFIGURED } from "../services/billing/stripe.js";
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
      const { Order } = getShopModels(getShopConnection(shopId));
      const order = await Order.findById(orderId);
      if (order) {
        const paidCents = session.amount_total ?? 0;
        order.paymentStatus = paidCents >= Math.round(order.total * 100) ? "paid" : "partial";
        await order.save();
        await order.populate("customer");
        emitToShop(shopId, EVENTS.ORDER_UPDATED, order);
      }
    }
  }

  res.json({ received: true });
});

export default router;
