import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import { getShopConnection } from "../services/shopConnection.js";
import { verifyOAuthState } from "../services/storageOAuth/state.js";

const router = Router();

// Stand-in for Dropbox/Google's own authorization screen — only ever
// reachable when the platform hasn't registered real app credentials yet
// (see settingsStorage.routes.ts). Confirming here creates a dummy
// StorageConnection; actual uploads against it are quietly redirected to
// internal storage (see dropboxProvider.ts / googleDriveProvider.ts)
// rather than hitting a real API with a fake token.

router.get("/dummy-connect/:token", async (req, res) => {
  let decoded;
  try {
    decoded = verifyOAuthState(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }
  const shop = await Shop.findById(decoded.shopId);
  if (!shop) return res.status(404).json({ error: "This link is invalid or has expired." });
  res.json({ shopName: shop.name, provider: decoded.provider });
});

router.post("/dummy-connect/:token/complete", async (req, res) => {
  let decoded;
  try {
    decoded = verifyOAuthState(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }

  // "dummy_token_" prefix is what dropboxProvider/googleDriveProvider check
  // to redirect uploads to internal storage instead of a real API call.
  const marker = `dummy_${decoded.provider}_${Date.now().toString(36)}`;
  const { StorageConnection } = getShopModels(getShopConnection(decoded.shopId));
  await StorageConnection.findOneAndUpdate(
    { provider: decoded.provider },
    {
      provider: decoded.provider,
      accessToken: `dummy_token_${marker}`,
      refreshToken: `dummy_refresh_${marker}`,
      accountLabel: `${marker} (test)`,
      connectedBy: decoded.userId,
    },
    { upsert: true }
  );
  res.json({ message: "Test account connected." });
});

export default router;
