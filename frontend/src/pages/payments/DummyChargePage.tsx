import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import type { DummyChargeInfo } from "../../types/index.js";

// Stand-in for a real Stripe Checkout payment page — only ever reachable
// when the shop's payment connection is still the dummy one (see
// orders.routes.ts charge-link). Confirming here marks the order paid the
// same way a real webhook would, no card or processor involved.
export default function DummyChargePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DummyChargeInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    apiFetch<DummyChargeInfo>(`/payments/dummy-charge/${token}`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await apiFetch(`/payments/dummy-charge/${token}/complete`, { method: "POST" });
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

  const done = confirmed || info.paymentStatus === "paid";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
        </div>
        <span className="badge badge-order-design_approval" style={{ marginBottom: 16 }}>
          Test mode — no real payment
        </span>
        <h1 className="auth-title">Hi {info.customerName ?? "there"}</h1>
        <p className="auth-subtitle">
          Amount due: ${info.amount.toFixed(2)}
          {info.amount < info.orderTotal ? ` of $${info.orderTotal.toFixed(2)} total` : ""}
        </p>

        {done ? (
          <p className="cell-muted" style={{ marginTop: 20, fontSize: 14 }}>
            Test payment received — thank you! No card was charged.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Confirming…" : "Confirm test payment"}
          </button>
        )}
      </div>
    </div>
  );
}
