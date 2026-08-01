import crypto from "node:crypto";
import { refreshSquareAccessToken } from "../paymentOAuth/squareConnect.js";

const SQUARE_BASE = process.env.SQUARE_ENV === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";
const SQUARE_VERSION = "2025-01-23";

async function squareFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Square API request to ${path} failed: ${await res.text()}`);
  }
  return res.json();
}

// Payment Links require a location — merchants aren't asked to pick one
// during connect, so this just uses whichever comes back first (the
// overwhelming majority of connected shops have exactly one location).
async function getDefaultLocationId(accessToken: string): Promise<string> {
  const data = (await squareFetch("/v2/locations", accessToken)) as {
    locations?: { id: string }[];
  };
  const locationId = data.locations?.[0]?.id;
  if (!locationId) throw new Error("This Square account has no locations to charge against.");
  return locationId;
}

export async function createSquarePaymentLink(
  accessToken: string,
  amountUsd: number,
  redirectUrl: string
): Promise<string> {
  const locationId = await getDefaultLocationId(accessToken);
  const data = (await squareFetch("/v2/online-checkout/payment-links", accessToken, {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: "Order payment",
        price_money: { amount: Math.round(amountUsd * 100), currency: "USD" },
        location_id: locationId,
      },
      checkout_options: { redirect_url: redirectUrl },
    }),
  })) as { payment_link?: { url: string } };
  if (!data.payment_link?.url) throw new Error("Square didn't return a payment link URL.");
  return data.payment_link.url;
}

// Square access tokens expire (~30 days); refresh once on a 401 and
// persist the new token, same retry-once shape as the Dropbox provider.
export async function withSquareAutoRefresh<T>(
  accessToken: string,
  refreshToken: string,
  onRefreshed: (token: string) => Promise<void>,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(accessToken);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("401")) throw err;
    const freshToken = await refreshSquareAccessToken(refreshToken);
    await onRefreshed(freshToken);
    return fn(freshToken);
  }
}

// Confirms payment server-side rather than trusting the redirect alone —
// the customer's browser hitting our redirect_url proves they got sent
// back, not that Square actually captured the money. Square appends
// order_id as a query param on that redirect; this looks that order up
// directly against Square's API using the shop's own access token.
export async function getSquareOrderState(accessToken: string, orderId: string): Promise<string | undefined> {
  const data = (await squareFetch(`/v2/orders/${orderId}`, accessToken)) as {
    order?: { state?: string };
  };
  return data.order?.state;
}
