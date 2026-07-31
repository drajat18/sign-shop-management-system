import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import { STORAGE_OAUTH_PROVIDERS, type StorageOAuthProvider } from "../models/StorageConnection.js";
import { getShopConnection } from "../services/shopConnection.js";
import { exchangeDropboxCode } from "../services/storageOAuth/dropboxOAuth.js";
import { exchangeGoogleCode } from "../services/storageOAuth/googleOAuth.js";
import { verifyOAuthState } from "../services/storageOAuth/state.js";

const router = Router();

function isStorageProvider(value: string): value is StorageOAuthProvider {
  return (STORAGE_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function settingsRedirect(params: Record<string, string>): string {
  const url = new URL(`${process.env.FRONTEND_URL}/admin`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

// Hit directly by Dropbox/Google after the shop admin approves access —
// no login of ours involved, so the signed state param (see state.ts) is
// the only thing tying this request back to a specific shop and admin.
router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  const { code, state, error: providerError } = req.query as { code?: string; state?: string; error?: string };

  if (!isStorageProvider(provider)) {
    return res.status(400).json({ error: "Unknown storage provider" });
  }
  if (providerError) {
    return res.redirect(settingsRedirect({ storage: "error", provider, message: providerError }));
  }
  if (!code || !state) {
    return res.redirect(settingsRedirect({ storage: "error", provider, message: "missing_code" }));
  }

  let decoded;
  try {
    decoded = verifyOAuthState(state);
  } catch {
    return res.redirect(settingsRedirect({ storage: "error", provider, message: "invalid_state" }));
  }
  if (decoded.provider !== provider) {
    return res.redirect(settingsRedirect({ storage: "error", provider, message: "provider_mismatch" }));
  }

  try {
    const { StorageConnection } = getShopModels(getShopConnection(decoded.shopId));
    if (provider === "dropbox") {
      const tokens = await exchangeDropboxCode(code);
      await StorageConnection.findOneAndUpdate(
        { provider },
        {
          provider,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accountLabel: tokens.accountId,
          connectedBy: decoded.userId,
        },
        { upsert: true }
      );
    } else {
      const tokens = await exchangeGoogleCode(code);
      await StorageConnection.findOneAndUpdate(
        { provider },
        {
          provider,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accountLabel: tokens.accountEmail,
          connectedBy: decoded.userId,
        },
        { upsert: true }
      );
    }
    res.redirect(settingsRedirect({ storage: "connected", provider }));
  } catch (err) {
    res.redirect(settingsRedirect({ storage: "error", provider, message: (err as Error).message }));
  }
});

export default router;
