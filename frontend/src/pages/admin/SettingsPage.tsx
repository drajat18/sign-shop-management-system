import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { usePlan, usePlanRefetch } from "../../auth/PlanContext.js";
import { createPricingRule, deletePricingRule, listPricingRules } from "../../api/pricingRules.js";
import type {
  AccountingConnectionStatus,
  AccountingProvider,
  CheckoutLink,
  NotificationsResponse,
  PaymentConnectionStatus,
  PaymentOAuthProvider,
  PlanTier,
  PricingMethod,
  PricingRule,
  StorageConnectionStatus,
  StorageOAuthProvider,
} from "../../types/index.js";
import { PRICING_METHODS } from "../../types/index.js";
import { formatBytes } from "../../utils/bytes.js";

const PROVIDER_LABEL: Record<StorageOAuthProvider, string> = {
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

const PAYMENT_PROVIDER_LABEL: Record<PaymentOAuthProvider, string> = {
  stripe: "Stripe",
  square: "Square",
  paypal: "PayPal",
};

const ACCOUNTING_PROVIDER_LABEL: Record<AccountingProvider, string> = {
  quickbooks: "QuickBooks",
};

const PRICING_METHOD_LABEL: Record<PricingMethod, string> = {
  flat: "Flat price",
  per_sqft: "Per square foot",
  cost_plus: "Cost plus margin",
};

const GB = 1024 ** 3;

const TIER_ORDER: PlanTier[] = ["starter", "growth", "pro"];

interface TierDetails {
  label: string;
  price: number;
  employeeLimit: number | null;
  storageGb: number;
  features: { reports: boolean; customer_portal: boolean; qr_tickets: boolean };
}

const TIER_DETAILS: Record<PlanTier, TierDetails> = {
  starter: {
    label: "Starter",
    price: 59.99,
    employeeLimit: 3,
    storageGb: 5,
    features: { reports: false, customer_portal: false, qr_tickets: false },
  },
  growth: {
    label: "Growth",
    price: 119.99,
    employeeLimit: 10,
    storageGb: 25,
    features: { reports: true, customer_portal: true, qr_tickets: true },
  },
  pro: {
    label: "Pro",
    price: 199.99,
    employeeLimit: null,
    storageGb: 100,
    features: { reports: true, customer_portal: true, qr_tickets: true },
  },
};

const FEATURE_ROWS: { key: keyof TierDetails["features"]; label: string }[] = [
  { key: "reports", label: "Reports" },
  { key: "customer_portal", label: "Customer portal" },
  { key: "qr_tickets", label: "QR job tickets" },
];

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

  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);

  useEffect(() => {
    apiFetch<NotificationsResponse>("/notifications", { token }).then(setNotifications).catch(console.error);
  }, [token]);

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

  const [accountingStatus, setAccountingStatus] = useState<Record<AccountingProvider, AccountingConnectionStatus> | null>(
    null
  );
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const [busyAccountingProvider, setBusyAccountingProvider] = useState<AccountingProvider | null>(null);

  function loadAccountingStatus() {
    apiFetch<Record<AccountingProvider, AccountingConnectionStatus>>("/settings/accounting", { token })
      .then(setAccountingStatus)
      .catch(console.error);
  }

  useEffect(loadAccountingStatus, [token]);

  const accountingRedirectResult = searchParams.get("accounting");

  useEffect(() => {
    if (accountingRedirectResult) {
      loadAccountingStatus();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountingRedirectResult]);

  async function handleConnectAccounting(provider: AccountingProvider) {
    setAccountingError(null);
    setBusyAccountingProvider(provider);
    try {
      const { url } = await apiFetch<{ url: string }>(`/settings/accounting/${provider}/connect`, {
        method: "POST",
        token,
      });
      window.location.href = url;
    } catch (err) {
      setAccountingError(err instanceof Error ? err.message : "Failed to start connection");
      setBusyAccountingProvider(null);
    }
  }

  async function handleDisconnectAccounting(provider: AccountingProvider) {
    setAccountingError(null);
    setBusyAccountingProvider(provider);
    try {
      await apiFetch(`/settings/accounting/${provider}/disconnect`, { method: "POST", token });
      loadAccountingStatus();
    } catch (err) {
      setAccountingError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setBusyAccountingProvider(null);
    }
  }

  const [pricingRules, setPricingRules] = useState<PricingRule[] | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState<{
    signType: string;
    method: PricingMethod;
    flatPrice: number;
    pricePerSqft: number;
    costPlusMarginPercent: number;
    minPrice: number;
  }>({ signType: "", method: "per_sqft", flatPrice: 0, pricePerSqft: 0, costPlusMarginPercent: 0, minPrice: 0 });
  const [ruleBusy, setRuleBusy] = useState(false);

  function loadPricingRules() {
    listPricingRules(token).then(setPricingRules).catch(console.error);
  }

  useEffect(loadPricingRules, [token]);

  async function handleAddRule() {
    if (!ruleForm.signType.trim()) return;
    setRuleBusy(true);
    setPricingError(null);
    try {
      await createPricingRule(
        {
          signType: ruleForm.signType,
          method: ruleForm.method,
          flatPrice: ruleForm.method === "flat" ? ruleForm.flatPrice : undefined,
          pricePerSqft: ruleForm.method === "per_sqft" ? ruleForm.pricePerSqft : undefined,
          costPlusMarginPercent: ruleForm.method === "cost_plus" ? ruleForm.costPlusMarginPercent : undefined,
          minPrice: ruleForm.minPrice || undefined,
        },
        token
      );
      setRuleForm({ signType: "", method: "per_sqft", flatPrice: 0, pricePerSqft: 0, costPlusMarginPercent: 0, minPrice: 0 });
      setShowAddRule(false);
      loadPricingRules();
    } catch (err) {
      setPricingError(err instanceof Error ? err.message : "Failed to add pricing rule");
    } finally {
      setRuleBusy(false);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("Remove this pricing rule?")) return;
    try {
      await deletePricingRule(id, token);
      loadPricingRules();
    } catch (err) {
      setPricingError(err instanceof Error ? err.message : "Failed to remove rule");
    }
  }

  const plan = usePlan();
  const refetchPlan = usePlanRefetch();
  const [billingTier, setBillingTier] = useState<PlanTier>(plan?.planTier ?? "starter");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState<"plan" | "storage" | null>(null);

  useEffect(() => {
    if (plan) setBillingTier(plan.planTier);
  }, [plan]);

  const billingRedirectResult = searchParams.get("billing");

  useEffect(() => {
    if (billingRedirectResult) {
      refetchPlan();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingRedirectResult]);

  async function handleChangePlan() {
    setBillingError(null);
    setBillingBusy("plan");
    try {
      const { url } = await apiFetch<CheckoutLink>("/settings/billing/checkout-link", {
        method: "POST",
        token,
        body: JSON.stringify({ planTier: billingTier }),
      });
      window.location.href = url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Failed to start checkout");
      setBillingBusy(null);
    }
  }

  async function handleBuyStorage(quantity: number) {
    setBillingError(null);
    setBillingBusy("storage");
    try {
      const { url } = await apiFetch<CheckoutLink>("/settings/billing/storage-addon-link", {
        method: "POST",
        token,
        body: JSON.stringify({ quantity }),
      });
      window.location.href = url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Failed to start checkout");
      setBillingBusy(null);
    }
  }

  // Add-ons persist across a tier change (they're a separate purchase, not
  // part of any one tier), so the limit a downgrade would leave you with is
  // the target tier's base storage *plus* whatever add-ons are already
  // owned — not just the target tier's base alone.
  const isDowngrade = plan ? TIER_ORDER.indexOf(billingTier) < TIER_ORDER.indexOf(plan.planTier) : false;
  const targetLimitBytesAfterChange = plan
    ? TIER_DETAILS[billingTier].storageGb * GB + plan.storage.addonUnits * plan.storage.addonUnitGb * GB
    : 0;
  const storageOverageBytes = plan ? Math.max(0, plan.storage.usedBytes - targetLimitBytesAfterChange) : 0;
  const neededAddonUnits =
    plan && storageOverageBytes > 0 ? Math.ceil(storageOverageBytes / (plan.storage.addonUnitGb * GB)) : 0;
  const targetEmployeeLimit = TIER_DETAILS[billingTier].employeeLimit;
  const employeeOverage =
    plan && targetEmployeeLimit !== null ? Math.max(0, plan.employeeCount - targetEmployeeLimit) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Shop-wide configuration and integrations.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Plan & billing</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Your current plan, seat usage, and storage — upgrade, downgrade, or add more storage any
          time.
        </p>

        {billingRedirectResult === "cancelled" && (
          <p className="cell-muted" style={{ marginBottom: 16 }}>
            Checkout was cancelled — nothing changed.
          </p>
        )}
        {billingError && <p className="form-error" style={{ marginBottom: 16 }}>{billingError}</p>}

        {plan === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="badge badge-order-completed">
                {plan.planTier.charAt(0).toUpperCase() + plan.planTier.slice(1)} — {plan.subscriptionStatus}
              </span>
              <span className="cell-muted" style={{ fontSize: 13 }}>
                {plan.employeeCount} / {plan.employeeLimit ?? "unlimited"} employees
              </span>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Storage</span>
                <span className="cell-muted" style={{ fontSize: 13 }}>
                  {formatBytes(plan.storage.usedBytes)} / {formatBytes(plan.storage.limitBytes)}
                  {plan.storage.addonUnits > 0 &&
                    ` (includes ${plan.storage.addonUnits} × ${plan.storage.addonUnitGb}GB add-on${plan.storage.addonUnits > 1 ? "s" : ""})`}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "var(--color-border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (plan.storage.usedBytes / Math.max(1, plan.storage.limitBytes)) * 100)}%`,
                    background: "var(--color-primary)",
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    {TIER_ORDER.map((tier) => (
                      <th key={tier} style={{ textAlign: "center" }}>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="billingTier"
                            checked={billingTier === tier}
                            onChange={() => setBillingTier(tier)}
                          />
                          {TIER_DETAILS[tier].label}
                          {plan.planTier === tier && (
                            <span className="badge badge-order-completed">Current</span>
                          )}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="cell-muted">Price</td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} style={{ textAlign: "center" }}>
                        ${TIER_DETAILS[tier].price.toFixed(2)}/mo
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="cell-muted">Employees</td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} style={{ textAlign: "center" }}>
                        {TIER_DETAILS[tier].employeeLimit ?? "Unlimited"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="cell-muted">Storage</td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} style={{ textAlign: "center" }}>
                        {TIER_DETAILS[tier].storageGb}GB
                      </td>
                    ))}
                  </tr>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="cell-muted">{row.label}</td>
                      {TIER_ORDER.map((tier) => (
                        <td key={tier} style={{ textAlign: "center" }}>
                          {TIER_DETAILS[tier].features[row.key] ? "✓" : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {billingTier !== plan.planTier && isDowngrade && (storageOverageBytes > 0 || employeeOverage > 0) && (
              <div className="form-error" style={{ display: "grid", gap: 8 }}>
                {storageOverageBytes > 0 && (
                  <p>
                    Downgrading to {TIER_DETAILS[billingTier].label} would put you over your storage
                    limit — you're using {formatBytes(plan.storage.usedBytes)}, but this plan (plus your
                    existing add-ons) only covers {formatBytes(targetLimitBytesAfterChange)}. New uploads
                    would be blocked until you're back under the limit. Buy {neededAddonUnits} more +
                    {plan.storage.addonUnitGb}GB add-on{neededAddonUnits > 1 ? "s" : ""} to cover the gap,
                    or free up space first.
                  </p>
                )}
                {employeeOverage > 0 && (
                  <p>
                    You have {plan.employeeCount} active employees — {TIER_DETAILS[billingTier].label}{" "}
                    only includes {targetEmployeeLimit}. Nobody gets deactivated automatically, but you
                    won't be able to add new employees until you're at or under the limit.
                  </p>
                )}
                {storageOverageBytes > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ justifySelf: "start" }}
                    onClick={() => handleBuyStorage(neededAddonUnits)}
                    disabled={billingBusy !== null}
                  >
                    {billingBusy === "storage"
                      ? "Redirecting…"
                      : `Buy ${neededAddonUnits} × +${plan.storage.addonUnitGb}GB to cover this`}
                  </button>
                )}
              </div>
            )}

            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleChangePlan}
                disabled={billingBusy !== null || billingTier === plan.planTier}
              >
                {billingBusy === "plan"
                  ? "Redirecting…"
                  : `Switch to ${TIER_DETAILS[billingTier].label}`}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>Need more space?</p>
                <p className="cell-muted" style={{ fontSize: 13 }}>
                  Buy +{plan.storage.addonUnitGb}GB of storage for $9.99/mo, stackable, available on
                  every plan.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleBuyStorage(1)}
                disabled={billingBusy !== null}
              >
                {billingBusy === "storage" ? "Redirecting…" : `Buy +${plan.storage.addonUnitGb}GB`}
              </button>
            </div>
          </div>
        )}
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
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Accounting</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Connect QuickBooks to mark orders as synced from an order's detail view. Full order data is
          also always available as a CSV export from the Orders page either way.
        </p>

        {accountingRedirectResult === "connected" && (
          <p className="cell-muted" style={{ marginBottom: 16, color: "var(--color-success)" }}>
            Connected.
          </p>
        )}
        {accountingError && <p className="form-error" style={{ marginBottom: 16 }}>{accountingError}</p>}

        {accountingStatus === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {(Object.keys(ACCOUNTING_PROVIDER_LABEL) as AccountingProvider[]).map((provider) => {
              const s = accountingStatus[provider];
              const label = ACCOUNTING_PROVIDER_LABEL[provider];
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
                      <span className={`badge ${s.connected ? "badge-order-completed" : "badge-order-new"}`}>
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
                      onClick={() => handleDisconnectAccounting(provider)}
                      disabled={busyAccountingProvider === provider}
                    >
                      {busyAccountingProvider === provider ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConnectAccounting(provider)}
                      disabled={busyAccountingProvider === provider}
                    >
                      {busyAccountingProvider === provider ? "Redirecting…" : `Connect ${label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pricing rules</h2>
            <p className="cell-muted" style={{ marginBottom: 16, maxWidth: 560 }}>
              Define how a sign type is priced once — a matching rule shows a "Calculate price" button
              on that item everywhere it's entered. Cost-plus rules use the simulated material-cost
              lookup as their input, so they're only as real as that number is today.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddRule((s) => !s)}>
            + Add rule
          </button>
        </div>

        {pricingError && <p className="form-error" style={{ marginBottom: 16 }}>{pricingError}</p>}

        {showAddRule && (
          <div className="item-card" style={{ marginBottom: 16 }}>
            <div className="item-grid-primary">
              <label className="field">
                Sign type
                <input
                  placeholder="Storefront sign"
                  value={ruleForm.signType}
                  onChange={(e) => setRuleForm({ ...ruleForm, signType: e.target.value })}
                />
              </label>
              <label className="field">
                Method
                <select
                  value={ruleForm.method}
                  onChange={(e) => setRuleForm({ ...ruleForm, method: e.target.value as PricingMethod })}
                >
                  {PRICING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PRICING_METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              {ruleForm.method === "flat" && (
                <label className="field">
                  Flat price
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={ruleForm.flatPrice}
                    onChange={(e) => setRuleForm({ ...ruleForm, flatPrice: Number(e.target.value) || 0 })}
                  />
                </label>
              )}
              {ruleForm.method === "per_sqft" && (
                <label className="field">
                  Price per sqft
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={ruleForm.pricePerSqft}
                    onChange={(e) => setRuleForm({ ...ruleForm, pricePerSqft: Number(e.target.value) || 0 })}
                  />
                </label>
              )}
              {ruleForm.method === "cost_plus" && (
                <label className="field">
                  Margin (%)
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={ruleForm.costPlusMarginPercent}
                    onChange={(e) => setRuleForm({ ...ruleForm, costPlusMarginPercent: Number(e.target.value) || 0 })}
                  />
                </label>
              )}
            </div>
            <label className="field" style={{ maxWidth: 200 }}>
              Minimum price (optional)
              <input
                type="number"
                min={0}
                step="0.01"
                value={ruleForm.minPrice}
                onChange={(e) => setRuleForm({ ...ruleForm, minPrice: Number(e.target.value) || 0 })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddRule(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddRule} disabled={ruleBusy}>
                {ruleBusy ? "Adding…" : "Add rule"}
              </button>
            </div>
          </div>
        )}

        {pricingRules === null ? (
          <p className="cell-muted">Loading…</p>
        ) : pricingRules.length === 0 ? (
          <p className="cell-muted" style={{ fontSize: 13 }}>
            No pricing rules yet — items are priced by hand until one's added.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sign type</th>
                <th>Method</th>
                <th>Rate</th>
                <th>Min price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pricingRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="cell-primary">{rule.signType}</td>
                  <td className="cell-muted">{PRICING_METHOD_LABEL[rule.method]}</td>
                  <td className="cell-muted">
                    {rule.method === "flat" && `$${(rule.flatPrice ?? 0).toFixed(2)}`}
                    {rule.method === "per_sqft" && `$${(rule.pricePerSqft ?? 0).toFixed(2)}/sqft`}
                    {rule.method === "cost_plus" && `+${rule.costPlusMarginPercent ?? 0}% over cost`}
                  </td>
                  <td className="cell-muted">{rule.minPrice ? `$${rule.minPrice.toFixed(2)}` : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Notifications</h2>
        <p className="cell-muted" style={{ marginBottom: 16 }}>
          Password resets, order updates, and messages send automatically. This is a log of what's gone
          out — useful to confirm the feature is working before real email/SMS credentials are set up.
        </p>

        {notifications === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <span className={`badge ${notifications.emailConfigured ? "badge-order-completed" : "badge-order-new"}`}>
                Email {notifications.emailConfigured ? "configured" : "test mode"}
              </span>
              <span className={`badge ${notifications.smsConfigured ? "badge-order-completed" : "badge-order-new"}`}>
                SMS {notifications.smsConfigured ? "configured" : "test mode"}
              </span>
            </div>

            {notifications.logs.length === 0 ? (
              <p className="cell-muted" style={{ fontSize: 13 }}>
                Nothing sent yet.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>To</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.logs.map((log) => (
                    <tr key={log.id}>
                      <td className="cell-muted">{log.channel === "email" ? "Email" : "SMS"}</td>
                      <td className="cell-primary">{log.to}</td>
                      <td className="cell-muted">{log.trigger.replace(/_/g, " ")}</td>
                      <td>
                        <span className={`badge ${log.status === "failed" ? "badge-job-blocked" : "badge-order-completed"}`}>
                          {log.status === "failed" ? "Failed" : "Sent"}
                        </span>
                        {log.status === "failed" && log.error && (
                          <p className="cell-muted" style={{ fontSize: 12, marginTop: 4, maxWidth: 260 }}>
                            {log.error}
                          </p>
                        )}
                      </td>
                      <td className="cell-muted">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
