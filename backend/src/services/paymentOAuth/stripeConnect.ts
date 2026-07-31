import { paymentCallbackUrl } from "./state.js";

// Distinct from Stripe being "configured" for platform billing (Phase 4) —
// Connect needs its own client_id from the platform's Stripe Connect
// settings on top of the same secret key, so the two features can be
// enabled independently.
export const STRIPE_CONNECT_CONFIGURED = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID
);

export function buildStripeConnectAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: "read_write",
    redirect_uri: paymentCallbackUrl("stripe"),
    state,
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStripeConnectCode(code: string): Promise<{ connectedAccountId: string }> {
  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });
  if (!res.ok) {
    throw new Error(`Stripe Connect token exchange failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { stripe_user_id?: string; error_description?: string };
  if (!data.stripe_user_id) {
    throw new Error(data.error_description ?? "Stripe didn't return a connected account id.");
  }
  return { connectedAccountId: data.stripe_user_id };
}
