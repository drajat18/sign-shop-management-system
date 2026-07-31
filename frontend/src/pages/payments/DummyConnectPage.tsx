import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import type { DummyPaymentConnectInfo } from "../../types/index.js";

const PROVIDER_LABEL: Record<string, string> = { stripe: "Stripe" };

// Stand-in for Stripe Connect's own authorization screen — only ever
// reachable when the platform hasn't set up Connect yet (see
// settingsPayments.routes.ts). Confirming here creates a dummy
// PaymentConnection so the rest of the payment-collection flow is
// testable with no real processor.
export default function DummyConnectPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DummyPaymentConnectInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    apiFetch<DummyPaymentConnectInfo>(`/payments/dummy-connect/${token}`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await apiFetch(`/payments/dummy-connect/${token}/complete`, { method: "POST" });
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
          Connect a test {PROVIDER_LABEL[info.provider] ?? info.provider} account to collect customer
          payments.
        </p>

        {confirmed ? (
          <p className="cell-muted" style={{ marginTop: 20, fontSize: 14 }}>
            Test account connected. This shop can now generate payment links — no real processor
            involved.
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
