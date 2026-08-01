export const PAYPAL_CONFIGURED = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

export const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

// PayPal's partner APIs authenticate as the platform itself (client
// credentials), not as any individual merchant — the merchant's identity
// only ever shows up as a merchant_id parameter on later calls.
export async function getPaypalPlatformToken(): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Partner Referrals is how a platform onboards a merchant without ever
// seeing their PayPal login — the merchant completes onboarding entirely
// on PayPal's own pages, then lands back on returnUrl. Our signed state
// doubles as PayPal's tracking_id, so it round-trips back to us as the
// "merchantId" query param on return with no extra storage needed.
export async function createPaypalPartnerReferral(state: string, returnUrl: string): Promise<string> {
  const token = await getPaypalPlatformToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/customer/partner-referrals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tracking_id: state,
      operations: [{ operation: "API_INTEGRATION", api_integration_preference: { rest_api_integration: {
        integration_method: "PAYPAL", integration_type: "THIRD_PARTY",
        third_party_details: { features: ["PAYMENT", "REFUND"] },
      } } }],
      products: ["PPCP"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      partner_config_override: { return_url: returnUrl },
    }),
  });
  if (!res.ok) {
    throw new Error(`PayPal partner referral failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { links?: { rel: string; href: string }[] };
  const actionUrl = data.links?.find((l) => l.rel === "action_url")?.href;
  if (!actionUrl) throw new Error("PayPal didn't return an onboarding link.");
  return actionUrl;
}
