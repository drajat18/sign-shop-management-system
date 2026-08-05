import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type {
  PaymentConnectionStatus,
  PaymentOAuthProvider,
  SiteContent,
  SiteService,
  StorageConnectionStatus,
  StorageOAuthProvider,
} from "../../types/index.js";

// Matches .field input's look for the handful of inputs in the Services
// editor that aren't wrapped in a .field label (they sit in a custom grid
// alongside buttons instead).
const rawInputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  fontSize: 14,
  fontWeight: 400,
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const PROVIDER_LABEL: Record<StorageOAuthProvider, string> = {
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

const PAYMENT_PROVIDER_LABEL: Record<PaymentOAuthProvider, string> = {
  stripe: "Stripe",
  square: "Square",
  paypal: "PayPal",
};

type StatusResponse = Record<StorageOAuthProvider, StorageConnectionStatus>;
type PaymentStatusResponse = Record<PaymentOAuthProvider, PaymentConnectionStatus>;

// Shop-level Dropbox/Google Drive connection + employee management live
// here. Design doc: "Settings shows connected/disconnected status clearly
// to avoid silent failures."
export default function SettingsPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<StorageOAuthProvider | null>(null);

  function loadStatus() {
    apiFetch<StatusResponse>("/settings/storage", { token }).then(setStatus).catch(console.error);
  }

  useEffect(loadStatus, [token]);

  // The OAuth callback redirects back here with ?storage=connected|error —
  // surface that once, then drop the params so a page refresh doesn't
  // re-show a stale result.
  const redirectResult = searchParams.get("storage");
  const redirectProvider = searchParams.get("provider") as StorageOAuthProvider | null;
  const redirectMessage = searchParams.get("message");

  useEffect(() => {
    if (redirectResult) {
      loadStatus();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectResult]);

  async function handleConnect(provider: StorageOAuthProvider) {
    setError(null);
    setBusyProvider(provider);
    try {
      const { url } = await apiFetch<{ url: string }>(`/settings/storage/${provider}/connect`, {
        method: "POST",
        token,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection");
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: StorageOAuthProvider) {
    setError(null);
    setBusyProvider(provider);
    try {
      await apiFetch(`/settings/storage/${provider}/disconnect`, { method: "POST", token });
      loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setBusyProvider(null);
    }
  }

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [busyPaymentProvider, setBusyPaymentProvider] = useState<PaymentOAuthProvider | null>(null);

  function loadPaymentStatus() {
    apiFetch<PaymentStatusResponse>("/settings/payments", { token })
      .then(setPaymentStatus)
      .catch(console.error);
  }

  useEffect(loadPaymentStatus, [token]);

  const paymentRedirectResult = searchParams.get("payments");
  const paymentRedirectProvider = searchParams.get("provider") as PaymentOAuthProvider | null;
  const paymentRedirectMessage = searchParams.get("message");

  useEffect(() => {
    if (paymentRedirectResult) {
      loadPaymentStatus();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRedirectResult]);

  async function handleConnectPayment(provider: PaymentOAuthProvider) {
    setPaymentError(null);
    setBusyPaymentProvider(provider);
    try {
      const { url } = await apiFetch<{ url: string }>(`/settings/payments/${provider}/connect`, {
        method: "POST",
        token,
      });
      window.location.href = url;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to start connection");
      setBusyPaymentProvider(null);
    }
  }

  async function handleDisconnectPayment(provider: PaymentOAuthProvider) {
    setPaymentError(null);
    setBusyPaymentProvider(provider);
    try {
      await apiFetch(`/settings/payments/${provider}/disconnect`, { method: "POST", token });
      loadPaymentStatus();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setBusyPaymentProvider(null);
    }
  }

  const [site, setSite] = useState<SiteContent | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteSaved, setSiteSaved] = useState(false);

  useEffect(() => {
    apiFetch<SiteContent>("/settings/site", { token }).then(setSite).catch(console.error);
  }, [token]);

  function updateSiteField<K extends keyof SiteContent>(field: K, value: SiteContent[K]) {
    setSite((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSiteSaved(false);
  }

  function updateService(index: number, patch: Partial<SiteService>) {
    setSite((prev) => {
      if (!prev) return prev;
      const services = prev.services.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, services };
    });
    setSiteSaved(false);
  }

  function moveService(index: number, direction: -1 | 1) {
    setSite((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.services.length) return prev;
      const services = [...prev.services];
      [services[index], services[target]] = [services[target], services[index]];
      return { ...prev, services: services.map((s, i) => ({ ...s, sortOrder: i })) };
    });
    setSiteSaved(false);
  }

  function removeService(index: number) {
    setSite((prev) => (prev ? { ...prev, services: prev.services.filter((_, i) => i !== index) } : prev));
    setSiteSaved(false);
  }

  function addService() {
    setSite((prev) =>
      prev
        ? {
            ...prev,
            services: [
              ...prev.services,
              { key: "", title: "New service", description: "", enabled: true, sortOrder: prev.services.length },
            ],
          }
        : prev
    );
    setSiteSaved(false);
  }

  async function saveSite() {
    if (!site) return;
    setSiteError(null);
    setSiteSaving(true);
    try {
      const saved = await apiFetch<SiteContent>("/settings/site", {
        method: "PUT",
        token,
        body: JSON.stringify(site),
      });
      setSite(saved);
      setSiteSaved(true);
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSiteSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Shop-wide configuration and integrations.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>File storage</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Connect Dropbox or Google Drive once for the whole shop; staff can then choose to save
          design files there instead of internal storage.
        </p>

        {redirectResult === "connected" && redirectProvider && (
          <p className="cell-muted" style={{ marginBottom: 16, color: "var(--color-success)" }}>
            {PROVIDER_LABEL[redirectProvider]} connected.
          </p>
        )}
        {redirectResult === "error" && (
          <p className="form-error" style={{ marginBottom: 16 }}>
            Couldn't connect{redirectProvider ? ` ${PROVIDER_LABEL[redirectProvider]}` : ""}
            {redirectMessage ? `: ${redirectMessage}` : "."}
          </p>
        )}
        {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

        {status === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {(Object.keys(PROVIDER_LABEL) as StorageOAuthProvider[]).map((provider) => {
              const s = status[provider];
              const label = PROVIDER_LABEL[provider];
              return (
                <div
                  key={provider}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className={`badge ${s.connected ? "badge-order-completed" : "badge-order-new"}`}
                      >
                        {!s.configured ? "Not configured" : s.connected ? "Connected" : "Not connected"}
                      </span>
                      {s.connected && s.accountLabel && (
                        <span className="cell-muted" style={{ fontSize: 13 }}>
                          {s.accountLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {!s.configured ? (
                    <span className="cell-muted" style={{ fontSize: 13 }}>
                      Not set up by the platform yet
                    </span>
                  ) : s.connected ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleDisconnect(provider)}
                      disabled={busyProvider === provider}
                    >
                      {busyProvider === provider ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConnect(provider)}
                      disabled={busyProvider === provider}
                    >
                      {busyProvider === provider ? "Redirecting…" : `Connect ${label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Payments</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Connect your own Stripe account to collect payment directly from customers — the platform
          never touches this money.
        </p>

        {paymentRedirectResult === "connected" && paymentRedirectProvider && (
          <p className="cell-muted" style={{ marginBottom: 16, color: "var(--color-success)" }}>
            {PAYMENT_PROVIDER_LABEL[paymentRedirectProvider]} connected.
          </p>
        )}
        {paymentRedirectResult === "error" && (
          <p className="form-error" style={{ marginBottom: 16 }}>
            Couldn't connect{paymentRedirectProvider ? ` ${PAYMENT_PROVIDER_LABEL[paymentRedirectProvider]}` : ""}
            {paymentRedirectMessage ? `: ${paymentRedirectMessage}` : "."}
          </p>
        )}
        {paymentError && <p className="form-error" style={{ marginBottom: 16 }}>{paymentError}</p>}

        {paymentStatus === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {(Object.keys(PAYMENT_PROVIDER_LABEL) as PaymentOAuthProvider[]).map((provider) => {
              const s = paymentStatus[provider];
              const label = PAYMENT_PROVIDER_LABEL[provider];
              return (
                <div
                  key={provider}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className={`badge ${s.connected ? "badge-order-completed" : "badge-order-new"}`}
                      >
                        {s.connected ? "Connected" : "Not connected"}
                      </span>
                      {s.connected && s.accountLabel && (
                        <span className="cell-muted" style={{ fontSize: 13 }}>
                          {s.accountLabel}
                        </span>
                      )}
                      {!s.configured && (
                        <span className="cell-muted" style={{ fontSize: 13 }}>
                          — test mode, real {label} not set up yet
                        </span>
                      )}
                    </div>
                  </div>
                  {s.connected ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleDisconnectPayment(provider)}
                      disabled={busyPaymentProvider === provider}
                    >
                      {busyPaymentProvider === provider ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConnectPayment(provider)}
                      disabled={busyPaymentProvider === provider}
                    >
                      {busyPaymentProvider === provider ? "Redirecting…" : `Connect ${label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Public website</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          What customers see on your public services page — edit the details and the services you
          offer, then save.
        </p>

        {siteError && <p className="form-error" style={{ marginBottom: 16 }}>{siteError}</p>}
        {siteSaved && (
          <p className="cell-muted" style={{ marginBottom: 16, color: "var(--color-success)" }}>
            Saved.
          </p>
        )}

        {site === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              Tagline
              <input
                value={site.tagline}
                onChange={(e) => updateSiteField("tagline", e.target.value)}
                placeholder="Custom signs, banners, and vehicle graphics done right."
              />
            </label>

            <label className="field" style={{ marginBottom: 0 }}>
              About
              <textarea rows={3} value={site.aboutText} onChange={(e) => updateSiteField("aboutText", e.target.value)} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                Phone
                <input value={site.phone} onChange={(e) => updateSiteField("phone", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                Email
                <input value={site.email} onChange={(e) => updateSiteField("email", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                Address
                <input value={site.address} onChange={(e) => updateSiteField("address", e.target.value)} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                Hours
                <input
                  value={site.hours}
                  onChange={(e) => updateSiteField("hours", e.target.value)}
                  placeholder="Mon-Fri 8am-5pm"
                />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={site.published}
                onChange={(e) => updateSiteField("published", e.target.checked)}
              />
              Published (visible to the public)
            </label>

            <div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Services</p>
              <div style={{ display: "grid", gap: 12 }}>
                {site.services.map((service, index) => (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...rawInputStyle, flex: 1 }}
                        value={service.title}
                        onChange={(e) => updateService(index, { title: e.target.value })}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={service.enabled}
                          onChange={(e) => updateService(index, { enabled: e.target.checked })}
                        />
                        <span className="cell-muted" style={{ fontSize: 13 }}>Enabled</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => moveService(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => moveService(index, 1)}
                        disabled={index === site.services.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => removeService(index)}
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      style={rawInputStyle}
                      rows={2}
                      value={service.description}
                      onChange={(e) => updateService(index, { description: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={addService}>
                Add service
              </button>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveSite}
                disabled={siteSaving}
              >
                {siteSaving ? "Saving…" : "Save website"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
