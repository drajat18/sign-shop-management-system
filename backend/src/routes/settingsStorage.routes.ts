import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { STORAGE_OAUTH_PROVIDERS, type StorageOAuthProvider } from "../models/StorageConnection.js";
import { DROPBOX_OAUTH_CONFIGURED, buildDropboxAuthorizeUrl } from "../services/storageOAuth/dropboxOAuth.js";
import { GOOGLE_DRIVE_OAUTH_CONFIGURED, buildGoogleAuthorizeUrl } from "../services/storageOAuth/googleOAuth.js";
import { signOAuthState } from "../services/storageOAuth/state.js";

const router = Router();
router.use(requireAuth);

const CONFIGURED: Record<StorageOAuthProvider, boolean> = {
  dropbox: DROPBOX_OAUTH_CONFIGURED,
  google_drive: GOOGLE_DRIVE_OAUTH_CONFIGURED,
};

function isStorageProvider(value: string): value is StorageOAuthProvider {
  return (STORAGE_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

// Status for every provider at once so Settings can render both cards
// from a single call — "configured" (we have app credentials at all) is
// distinct from "connected" (this specific shop authorized us). Anyone who
// can upload a file also needs this, to know which save-location options
// to offer — not just admins viewing Settings.
router.get("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { StorageConnection } = req.models!;
  const connections = await StorageConnection.find();
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  res.json(
    Object.fromEntries(
      STORAGE_OAUTH_PROVIDERS.map((provider) => {
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
// registered real Dropbox/Google app credentials yet — same "configured
// vs dummy" split used for payment providers, so a shop admin can still
// click Connect and try the whole flow end to end.
router.post("/:provider/connect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isStorageProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${STORAGE_OAUTH_PROVIDERS.join(", ")}` });
  }

  const state = signOAuthState({ shopId: req.auth!.shopId, userId: req.auth!.userId, provider });

  if (!CONFIGURED[provider]) {
    return res.json({ url: `${process.env.FRONTEND_URL}/storage/dummy-connect/${state}`, mode: "dummy" });
  }

  const url = provider === "dropbox" ? buildDropboxAuthorizeUrl(state) : buildGoogleAuthorizeUrl(state);
  res.json({ url, mode: provider });
});

router.post("/:provider/disconnect", requireRole("admin"), async (req, res) => {
  const provider = req.params.provider;
  if (!isStorageProvider(provider)) {
    return res.status(400).json({ error: `provider must be one of: ${STORAGE_OAUTH_PROVIDERS.join(", ")}` });
  }
  const { StorageConnection } = req.models!;
  await StorageConnection.deleteOne({ provider });
  res.json({ message: `${provider} disconnected.` });
});

export default router;
