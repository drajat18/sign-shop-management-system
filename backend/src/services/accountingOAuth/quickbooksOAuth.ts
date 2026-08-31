// Same "configured vs dummy" split as storageOAuth/dropboxOAuth.ts and
// paymentOAuth/*Connect.ts — QUICKBOOKS_OAUTH_CONFIGURED stays false until
// a real Intuit developer app's client id/secret are set, at which point
// settingsAccounting.routes.ts routes shops to the real authorize URL below
// instead of the dummy connect flow. Token exchange isn't implemented yet —
// there's nothing to test it against without real credentials, and
// unexercised exchange code is worse than none. Add it alongside the first
// real sync when those credentials exist.
export const QUICKBOOKS_OAUTH_CONFIGURED = Boolean(
  process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET
);

export function buildQuickbooksAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/accounting-oauth/quickbooks/callback`,
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}
