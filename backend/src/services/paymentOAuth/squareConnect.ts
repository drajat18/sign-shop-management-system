import { paymentCallbackUrl } from "./state.js";

export const SQUARE_CONFIGURED = Boolean(
  process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET
);

const SQUARE_BASE = process.env.SQUARE_ENV === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

// Square's OAuth scope for creating payment links on the merchant's
// behalf — narrower than full account access.
const SQUARE_SCOPE = "MERCHANT_PROFILE_READ ORDERS_WRITE PAYMENTS_WRITE";

export function buildSquareAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APPLICATION_ID!,
    scope: SQUARE_SCOPE,
    redirect_uri: paymentCallbackUrl("square"),
    state,
  });
  return `${SQUARE_BASE}/oauth2/authorize?${params.toString()}`;
}

interface SquareTokenResponse {
  access_token: string;
  refresh_token: string;
  merchant_id: string;
}

export interface SquareTokens {
  accessToken: string;
  refreshToken: string;
  merchantId: string;
}

async function tokenRequest(body: Record<string, string>): Promise<SquareTokenResponse> {
  const res = await fetch(`${SQUARE_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Square token request failed: ${await res.text()}`);
  }
  return res.json() as Promise<SquareTokenResponse>;
}

export async function exchangeSquareCode(code: string): Promise<SquareTokens> {
  const data = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: paymentCallbackUrl("square"),
  });
  return { accessToken: data.access_token, refreshToken: data.refresh_token, merchantId: data.merchant_id };
}

export async function refreshSquareAccessToken(refreshToken: string): Promise<string> {
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  return data.access_token;
}
