import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { PAYMENT_OAUTH_PROVIDERS, type PaymentOAuthProvider } from "../models/PaymentConnection.js";
import { PAYPAL_CONFIGURED, createPaypalPartnerReferral } from "../services/paymentOAuth/paypalConnect.js";
import { SQUARE_CONFIGURED, buildSquareAuthorizeUrl } from "../services/paymentOAuth/squareConnect.js";
import { STRIPE_CONNECT_CONFIGURED, buildStripeConnectAuthorizeUrl } from "../services/paymentOAuth/stripeConnect.js";
import { paymentCallbackUrl, signPaymentConnectState } from "../services/paymentOAuth/state.js";

const router = Router();
router.use(requireAuth);

const CONFIGURED: Record<PaymentOAuthProvider, boolean> = {
  stripe: STRIPE_CONNECT_CONFIGURED,
  square: SQUARE_CONFIGURED,
  paypal: PAYPAL_CONFIGURED,
};

function isPaymentProvider(value: string): value is PaymentOAuthProvider {
  return (PAYMENT_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

// Same "configured vs connected" split as the storage integrations —
// available to anyone who can take payments, not just admins, so front
// desk knows whether "Charge customer" will actually work.
router.get("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { PaymentConnection } = req.models!;
  const connections = await PaymentConnection.find();
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  res.json(
    Object.fromEntries(
      PAYMENT_OAUTH_PROVIDERS.map((provider) => {
        const connection = byProvider.get(provider);
        return [
          provider,
          {
            configured: CONFIGURED[provider],
            connected: Boolean(connection),
            accountLabel: connection?.accountLabel ?? connection?.connectedAccountId,
            connectedAt: connection?.createdAt,
          },
        ];
      })
    )
  );
});

router.post("/:provider/connect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isPaymentProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${PAYMENT_OAUTH_PROVIDERS.join(", ")}` });
  }

  const dummy = !CONFIGURED[provider];
  const state = signPaymentConnectState({
    shopId: req.auth!.shopId,
    userId: req.auth!.userId,
    provider,
    dummy,
  });

  if (dummy) {
    return res.json({ url: `${process.env.FRONTEND_URL}/payments/dummy-connect/${state}`, mode: "dummy" });
  }

  let url: string;
  switch (provider) {
    case "stripe":
      url = buildStripeConnectAuthorizeUrl(state);
      break;
    case "square":
      url = buildSquareAuthorizeUrl(state);
      break;
    case "paypal":
      // Unlike Stripe/Square (a plain authorize URL), PayPal's onboarding
      // link has to be requested from their API up front.
      url = await createPaypalPartnerReferral(state, paymentCallbackUrl("paypal"));
      break;
  }

  res.json({ url, mode: provider });
});

router.post("/:provider/disconnect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isPaymentProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${PAYMENT_OAUTH_PROVIDERS.join(", ")}` });
  }
  const { PaymentConnection } = req.models!;
  await PaymentConnection.deleteOne({ provider });
  res.json({ message: `${provider} disconnected.` });
});

export default router;
