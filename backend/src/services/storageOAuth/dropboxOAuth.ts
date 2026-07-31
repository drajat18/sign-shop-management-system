import { callbackUrl } from "./state.js";

export const DROPBOX_OAUTH_CONFIGURED = Boolean(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);

export interface DropboxTokens {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
}

export function buildDropboxAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY!,
    response_type: "code",
    redirect_uri: callbackUrl("dropbox"),
    state,
    // Without this Dropbox only ever hands back a short-lived access token
    // and no refresh_token, which would mean re-connecting every few hours.
    token_access_type: "offline",
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<{ access_token: string; refresh_token?: string; account_id?: string }> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Dropbox token request failed: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; refresh_token?: string; account_id?: string };
}

export async function exchangeDropboxCode(code: string): Promise<DropboxTokens> {
  const data = await tokenRequest(
    new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
      redirect_uri: callbackUrl("dropbox"),
    })
  );
  if (!data.refresh_token) {
    throw new Error("Dropbox didn't return a refresh token — check the app's OAuth settings.");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, accountId: data.account_id };
}

export async function refreshDropboxAccessToken(refreshToken: string): Promise<string> {
  const data = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
    })
  );
  return data.access_token;
}
