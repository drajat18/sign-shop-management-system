import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import type { DummyStorageConnectInfo } from "../../types/index.js";

const PROVIDER_LABEL: Record<string, string> = { dropbox: "Dropbox", google_drive: "Google Drive" };

// Stand-in for Dropbox/Google's own authorization screen — only ever
// reachable when the platform hasn't registered real app credentials yet
// (see settingsStorage.routes.ts). Confirming here creates a dummy
// StorageConnection so file uploads can be tested end to end with no real
// storage account.
export default function DummyStorageConnectPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DummyStorageConnectInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    apiFetch<DummyStorageConnectInfo>(`/storage-dummy/dummy-connect/${token}`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await apiFetch(`/storage-dummy/dummy-connect/${token}/complete`, { method: "POST" });
      setConfirmed(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark">S</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
          </div>
          <h1 className="auth-title">Link unavailable</h1>
          <p className="cell-muted" style={{ fontSize: 14 }}>
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="auth-page">
        <p className="cell-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
        </div>
        <span className="badge badge-order-design_approval" style={{ marginBottom: 16 }}>
          Test mode — no real account
        </span>
        <h1 className="auth-title">{info.shopName}</h1>
        <p className="auth-subtitle">
          Connect a test {PROVIDER_LABEL[info.provider] ?? info.provider} account to save design files
          there.
        </p>

        {confirmed ? (
          <p className="cell-muted" style={{ marginTop: 20, fontSize: 14 }}>
            Test account connected. This shop can now choose {PROVIDER_LABEL[info.provider] ?? info.provider}{" "}
            as a save location — no real storage account involved.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Connecting…" : `Connect ${PROVIDER_LABEL[info.provider] ?? info.provider} (test)`}
          </button>
        )}
      </div>
    </div>
  );
}
