import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import { PAYMENT_OAUTH_PROVIDERS, type PaymentOAuthProvider } from "../models/PaymentConnection.js";
import { getShopConnection } from "../services/shopConnection.js";
import { exchangeStripeConnectCode } from "../services/paymentOAuth/stripeConnect.js";
import { verifyPaymentConnectState } from "../services/paymentOAuth/state.js";

const router = Router();

function isPaymentProvider(value: string): value is PaymentOAuthProvider {
  return (PAYMENT_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function settingsRedirect(params: Record<string, string>): string {
  const url = new URL(`${process.env.FRONTEND_URL}/admin`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

// Hit directly by Stripe once a shop's admin approves the Connect
// authorization — same signed-state pattern as the storage integrations,
// no session of ours involved.
router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  const { code, state, error: providerError } = req.query as { code?: string; state?: string; error?: string };

  if (!isPaymentProvider(provider)) {
    return res.status(400).json({ error: "Unknown payment provider" });
  }
  if (providerError) {
    return res.redirect(settingsRedirect({ payments: "error", provider, message: providerError }));
  }
  if (!code || !state) {
    return res.redirect(settingsRedirect({ payments: "error", provider, message: "missing_code" }));
  }

  let decoded;
  try {
    decoded = verifyPaymentConnectState(state);
  } catch {
    return res.redirect(settingsRedirect({ payments: "error", provider, message: "invalid_state" }));
  }
  if (decoded.provider !== provider) {
    return res.redirect(settingsRedirect({ payments: "error", provider, message: "provider_mismatch" }));
  }

  try {
    const { connectedAccountId } = await exchangeStripeConnectCode(code);
    const { PaymentConnection } = getShopModels(getShopConnection(decoded.shopId));
    await PaymentConnection.findOneAndUpdate(
      { provider },
      { provider, connectedAccountId, accountLabel: connectedAccountId, connectedBy: decoded.userId },
      { upsert: true }
    );
    res.redirect(settingsRedirect({ payments: "connected", provider }));
  } catch (err) {
    res.redirect(settingsRedirect({ payments: "error", provider, message: (err as Error).message }));
  }
});

export default router;
