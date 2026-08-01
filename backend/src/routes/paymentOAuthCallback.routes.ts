import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import { PAYMENT_OAUTH_PROVIDERS, type PaymentOAuthProvider } from "../models/PaymentConnection.js";
import { getShopConnection } from "../services/shopConnection.js";
import { exchangeSquareCode } from "../services/paymentOAuth/squareConnect.js";
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

// PayPal's onboarding redirect is a different shape entirely — no `code`,
// no `state` param — so it needs its own route registered ahead of the
// generic `/:provider/callback` below (Express matches in registration
// order, and that route would otherwise swallow this one). Our signed
// state round-trips as PayPal's own `merchantId` (the tracking_id we
// supplied when creating the referral), and the actual PayPal merchant id
// comes back as `merchantIdInPayPal`.
router.get("/paypal/callback", async (req, res) => {
  const { merchantId, merchantIdInPayPal, permissionsGranted } = req.query as {
    merchantId?: string;
    merchantIdInPayPal?: string;
    permissionsGranted?: string;
  };

  if (!merchantId) {
    return res.redirect(settingsRedirect({ payments: "error", provider: "paypal", message: "missing_state" }));
  }

  let decoded;
  try {
    decoded = verifyPaymentConnectState(merchantId);
  } catch {
    return res.redirect(settingsRedirect({ payments: "error", provider: "paypal", message: "invalid_state" }));
  }
  if (decoded.provider !== "paypal") {
    return res.redirect(settingsRedirect({ payments: "error", provider: "paypal", message: "provider_mismatch" }));
  }
  if (permissionsGranted !== "true" || !merchantIdInPayPal) {
    return res.redirect(
      settingsRedirect({ payments: "error", provider: "paypal", message: "onboarding_incomplete" })
    );
  }

  const { PaymentConnection } = getShopModels(getShopConnection(decoded.shopId));
  await PaymentConnection.findOneAndUpdate(
    { provider: "paypal" },
    {
      provider: "paypal",
      connectedAccountId: merchantIdInPayPal,
      accountLabel: merchantIdInPayPal,
      connectedBy: decoded.userId,
    },
    { upsert: true }
  );
  res.redirect(settingsRedirect({ payments: "connected", provider: "paypal" }));
});

// Hit directly by Stripe/Square once a shop's admin approves the Connect
// authorization — a standard code+state OAuth callback, no session of
// ours involved.
router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  const { code, state, error: providerError } = req.query as { code?: string; state?: string; error?: string };

  if (!isPaymentProvider(provider) || provider === "paypal") {
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
    const { PaymentConnection } = getShopModels(getShopConnection(decoded.shopId));
    if (provider === "stripe") {
      const { connectedAccountId } = await exchangeStripeConnectCode(code);
      await PaymentConnection.findOneAndUpdate(
        { provider },
        { provider, connectedAccountId, accountLabel: connectedAccountId, connectedBy: decoded.userId },
        { upsert: true }
      );
    } else {
      const { merchantId, accessToken, refreshToken } = await exchangeSquareCode(code);
      await PaymentConnection.findOneAndUpdate(
        { provider },
        {
          provider,
          connectedAccountId: merchantId,
          accountLabel: merchantId,
          accessToken,
          refreshToken,
          connectedBy: decoded.userId,
        },
        { upsert: true }
      );
    }
    res.redirect(settingsRedirect({ payments: "connected", provider }));
  } catch (err) {
    res.redirect(settingsRedirect({ payments: "error", provider, message: (err as Error).message }));
  }
});

export default router;
