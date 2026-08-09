import { Router } from "express";
import type Stripe from "stripe";
import Shop, { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "../models/platform/Shop.js";
import { getStripe, STRIPE_CONFIGURED, tierForPriceId } from "../services/billing/stripe.js";

const router = Router();

// Stripe subscription statuses are a superset of ours (incomplete, unpaid,
// paused, ...) — collapse anything we don't explicitly track into the
// closest thing a shop's plan badge can show.
function normalizeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  if ((SUBSCRIPTION_STATUSES as readonly string[]).includes(stripeStatus)) {
    return stripeStatus as SubscriptionStatus;
  }
  if (stripeStatus === "unpaid" || stripeStatus === "incomplete_expired") return "past_due";
  if (stripeStatus === "paused") return "canceled";
  return "trialing"; // "incomplete" — checkout started but not finished yet
}

async function syncShopFromSubscription(subscription: Stripe.Subscription) {
  const shopId = subscription.metadata?.shopId;
  const shop = shopId ? await Shop.findById(shopId) : null;
  if (!shop) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const tier = priceId ? tierForPriceId(priceId) : undefined;

  shop.stripeSubscriptionId = subscription.id;
  shop.stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  shop.subscriptionStatus = normalizeStatus(subscription.status);
  if (tier) shop.planTier = tier;
  await shop.save();
}

// Storage add-ons are separate recurring subscriptions from the plan-tier
// one, purchased any number of times — each active subscription is worth
// its line item's quantity in +25GB units (a single checkout can buy
// several at once, e.g. covering a downgrade's storage gap in one click).
// Tracked by ID (rather than just a counter) so a single cancelled
// subscription decrements precisely instead of the whole count.
async function activateStorageAddon(subscription: Stripe.Subscription) {
  const shopId = subscription.metadata?.shopId;
  const shop = shopId ? await Shop.findById(shopId) : null;
  if (!shop) return;

  if (!shop.storageAddonSubscriptionIds?.includes(subscription.id)) {
    const quantity = subscription.items.data[0]?.quantity ?? 1;
    shop.storageAddonSubscriptionIds = [...(shop.storageAddonSubscriptionIds ?? []), subscription.id];
    shop.storageAddons = (shop.storageAddons ?? 0) + quantity;
    await shop.save();
  }
}

async function deactivateStorageAddon(subscription: Stripe.Subscription) {
  const shopId = subscription.metadata?.shopId;
  const shop = shopId ? await Shop.findById(shopId) : null;
  if (!shop || !shop.storageAddonSubscriptionIds?.includes(subscription.id)) return;

  const quantity = subscription.items.data[0]?.quantity ?? 1;
  shop.storageAddonSubscriptionIds = shop.storageAddonSubscriptionIds.filter((id) => id !== subscription.id);
  shop.storageAddons = Math.max(0, (shop.storageAddons ?? 0) - quantity);
  await shop.save();
}

// Mounted with express.raw() ahead of the global express.json() middleware
// (see index.ts) — Stripe's signature check needs the exact bytes it sent,
// which a JSON-parsed-then-re-stringified body would no longer match.
router.post("/", async (req, res) => {
  if (!STRIPE_CONFIGURED) return res.status(400).json({ error: "Billing isn't configured." });

  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: "Missing webhook signature or secret." });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        if (subscription.metadata?.kind === "storage_addon") {
          await activateStorageAddon(subscription);
        } else {
          await syncShopFromSubscription(subscription);
        }
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.metadata?.kind !== "storage_addon") {
        await syncShopFromSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.metadata?.kind === "storage_addon") {
        await deactivateStorageAddon(subscription);
      } else {
        await syncShopFromSubscription(subscription);
      }
      break;
    }
  }

  res.json({ received: true });
});

export default router;
