import { Router } from "express";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import { getShopConnection } from "../services/shopConnection.js";
import { verifyAccountingOAuthState } from "../services/accountingOAuth/state.js";

const router = Router();

// Stand-in for QuickBooks' own authorization screen — only reachable when
// the platform hasn't registered real app credentials yet (see
// settingsAccounting.routes.ts). Mirrors storageDummy.routes.ts exactly.

router.get("/dummy-connect/:token", async (req, res) => {
  let decoded;
  try {
    decoded = verifyAccountingOAuthState(req.params.token);
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
    decoded = verifyAccountingOAuthState(req.params.token);
  } catch {
    return res.status(404).json({ error: "This link is invalid or has expired." });
  }

  const marker = `dummy_${decoded.provider}_${Date.now().toString(36)}`;
  const { AccountingConnection } = getShopModels(getShopConnection(decoded.shopId));
  await AccountingConnection.findOneAndUpdate(
    { provider: decoded.provider },
    {
      provider: decoded.provider,
      connectedAccountId: marker,
      accountLabel: `${marker} (test)`,
      connectedBy: decoded.userId,
    },
    { upsert: true }
  );
  res.json({ message: "Test accounting account connected." });
});

export default router;
