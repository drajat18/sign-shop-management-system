import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { PAYMENT_OAUTH_PROVIDERS, type PaymentOAuthProvider } from "../models/PaymentConnection.js";
import { STRIPE_CONNECT_CONFIGURED, buildStripeConnectAuthorizeUrl } from "../services/paymentOAuth/stripeConnect.js";
import { signPaymentConnectState } from "../services/paymentOAuth/state.js";

const router = Router();
router.use(requireAuth);

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
            configured: provider === "stripe" ? STRIPE_CONNECT_CONFIGURED : false,
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

  const dummy = !STRIPE_CONNECT_CONFIGURED;
  const state = signPaymentConnectState({
    shopId: req.auth!.shopId,
    userId: req.auth!.userId,
    provider,
    dummy,
  });

  const url = dummy
    ? `${process.env.FRONTEND_URL}/payments/dummy-connect/${state}`
    : buildStripeConnectAuthorizeUrl(state);

  res.json({ url, mode: dummy ? "dummy" : "stripe" });
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
