import { google } from "googleapis";
import { callbackUrl } from "./state.js";

export const GOOGLE_DRIVE_OAUTH_CONFIGURED = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

// drive.file (not full drive access) — the app can only see/manage files
// it created itself, never a shop's existing Drive contents. Least
// privilege for what this feature actually needs.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function googleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl("google_drive")
  );
}

export function buildGoogleAuthorizeUrl(state: string): string {
  return googleOAuthClient().generateAuthUrl({
    access_type: "offline",
    // Forces the consent screen every time so a refresh_token is issued
    // even if this shop's admin previously granted access — Google only
    // returns one on the very first consent otherwise.
    prompt: "consent",
    scope: [DRIVE_SCOPE],
    state,
  });
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  accountEmail?: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const client = googleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token || !tokens.access_token) {
    throw new Error("Google didn't return a refresh token — check the OAuth consent screen settings.");
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get().catch(() => ({ data: {} as { email?: string } }));
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accountEmail: data.email ?? undefined,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const client = googleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token.");
  }
  return credentials.access_token;
}
