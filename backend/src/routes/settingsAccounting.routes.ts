import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { ACCOUNTING_PROVIDERS, type AccountingProvider } from "../models/AccountingConnection.js";
import { QUICKBOOKS_OAUTH_CONFIGURED, buildQuickbooksAuthorizeUrl } from "../services/accountingOAuth/quickbooksOAuth.js";
import { signAccountingOAuthState } from "../services/accountingOAuth/state.js";

const router = Router();
router.use(requireAuth);

const CONFIGURED: Record<AccountingProvider, boolean> = {
  quickbooks: QUICKBOOKS_OAUTH_CONFIGURED,
};

function isAccountingProvider(value: string): value is AccountingProvider {
  return (ACCOUNTING_PROVIDERS as readonly string[]).includes(value);
}

router.get("/", requireRole("admin"), async (req, res) => {
  const { AccountingConnection } = req.models!;
  const connections = await AccountingConnection.find();
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  res.json(
    Object.fromEntries(
      ACCOUNTING_PROVIDERS.map((provider) => {
        const connection = byProvider.get(provider);
        return [
          provider,
          {
            configured: CONFIGURED[provider],
            connected: Boolean(connection),
            accountLabel: connection?.accountLabel,
            connectedAt: connection?.createdAt,
          },
        ];
      })
    )
  );
});

// Falls back to a dummy connect flow whenever the platform hasn't
// registered real QuickBooks app credentials yet — same split used for
// payments and storage, so a shop admin can try the whole connect-and-sync
// flow today and it starts hitting the real API the moment credentials
// exist, with nothing else to change.
router.post("/:provider/connect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isAccountingProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${ACCOUNTING_PROVIDERS.join(", ")}` });
  }

  const state = signAccountingOAuthState({ shopId: req.auth!.shopId, userId: req.auth!.userId, provider });

  if (!CONFIGURED[provider]) {
    return res.json({ url: `${process.env.FRONTEND_URL}/accounting/dummy-connect/${state}`, mode: "dummy" });
  }

  res.json({ url: buildQuickbooksAuthorizeUrl(state), mode: provider });
});

router.post("/:provider/disconnect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isAccountingProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${ACCOUNTING_PROVIDERS.join(", ")}` });
  }
  const { AccountingConnection } = req.models!;
  await AccountingConnection.deleteOne({ provider });
  res.json({ message: `${provider} disconnected.` });
});

export default router;
