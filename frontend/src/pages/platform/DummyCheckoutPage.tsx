import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import type { DummyCheckoutSession } from "../../types/index.js";

// Stand-in for a real Stripe Checkout page — only ever reachable when the
// platform hasn't configured Stripe yet (see billing-link in
// shops.routes.ts / checkout-link in settingsBilling.routes.ts). Confirming
// here flips the shop's plan/status (or storage add-on count) exactly like
// the real Stripe webhook would, so the whole billing loop is testable
// without any external account.
export default function DummyCheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<DummyCheckoutSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function load() {
    apiFetch<DummyCheckoutSession>(`/billing/dummy-checkout/${token}`)
      .then((s) => {
        setSession(s);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load checkout"));
  }

  useEffect(load, [token]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await apiFetch(`/billing/dummy-checkout/${token}/complete`, { method: "POST" });
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

  if (!session) {
    return (
      <div className="auth-page">
        <p className="cell-muted">Loading…</p>
      </div>
    );
  }

  const done = confirmed || session.completed;

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
        <h1 className="auth-title">{session.shopName}</h1>
        <p className="auth-subtitle">
          {session.kind === "storage_addon"
            ? `${session.quantity > 1 ? `${session.quantity} × ` : ""}+25GB storage add-on${session.quantity > 1 ? "s" : ""}`
            : `${(session.planTier ?? "").charAt(0).toUpperCase()}${(session.planTier ?? "").slice(1)} plan`}
          {" — $"}
          {session.priceUsd.toFixed(2)}/month
        </p>

        {done ? (
          <>
            <p className="cell-muted" style={{ marginTop: 20, fontSize: 14 }}>
              {session.kind === "storage_addon"
                ? `Test storage add-on${session.quantity > 1 ? "s" : ""} activated. This shop's storage limit has been increased by ${session.quantity * 25}GB — no card was charged.`
                : "Test subscription activated. This shop's plan and status have been updated — no card was charged."}
            </p>
            <Link to="/admin?billing=success" className="btn btn-outline btn-block" style={{ marginTop: 12 }}>
              Return to Settings
            </Link>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Confirming…" : "Confirm test subscription"}
          </button>
        )}
      </div>
    </div>
  );
}
