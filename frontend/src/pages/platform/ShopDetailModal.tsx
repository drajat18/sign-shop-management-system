import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { usePlatformAuth } from "../../auth/PlatformAuthContext.js";
import type { Employee, PlanTier, Shop } from "../../types/index.js";

const PLAN_TIERS: { value: PlanTier; label: string }[] = [
  { value: "starter", label: "Starter — $59.99/mo" },
  { value: "growth", label: "Growth — $119.99/mo" },
  { value: "pro", label: "Pro — $199.99/mo" },
];

export default function ShopDetailModal({
  shopId,
  shopName,
  onClose,
}: {
  shopId: string;
  shopName: string;
  onClose: () => void;
}) {
  const { token, user } = usePlatformAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [billingTier, setBillingTier] = useState<PlanTier>("starter");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkMode, setLinkMode] = useState<"stripe" | "dummy" | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const canDeactivate = user?.role === "owner";
  const canManageBilling = user?.role === "owner" || user?.role === "billing";

  function loadShop() {
    apiFetch<Shop>(`/platform/shops/${shopId}`, { token })
      .then((s) => {
        setShop(s);
        setBillingTier(s.planTier);
      })
      .catch(console.error);
  }

  useEffect(loadShop, [shopId, token]);

  async function handleCopyBillingLink() {
    setBillingError(null);
    setGeneratingLink(true);
    try {
      const { url, mode } = await apiFetch<{ url: string; mode: "stripe" | "dummy" }>(
        `/platform/shops/${shopId}/billing-link`,
        { method: "POST", token, body: JSON.stringify({ planTier: billingTier }) }
      );
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setLinkMode(mode);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Failed to generate billing link");
    } finally {
      setGeneratingLink(false);
    }
  }

  function loadEmployees() {
    apiFetch<Employee[]>(`/platform/shops/${shopId}/users`, { token }).then(setEmployees).catch(console.error);
  }

  useEffect(loadEmployees, [shopId, token]);

  async function handleDeactivate(userId: string) {
    await apiFetch(`/platform/shops/${shopId}/users/${userId}/deactivate`, { method: "PATCH", token });
    loadEmployees();
  }

  async function handleReactivate(userId: string) {
    await apiFetch(`/platform/shops/${shopId}/users/${userId}/reactivate`, { method: "PATCH", token });
    loadEmployees();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{shopName}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {canManageBilling && (
          <div className="item-card" style={{ marginBottom: 20 }}>
            <div className="item-card-header">
              <span className="item-card-title">Billing</span>
              {shop && (
                <span
                  className={`badge ${shop.subscriptionStatus === "active" ? "badge-order-completed" : "badge-order-new"}`}
                >
                  {shop.planTier} — {shop.subscriptionStatus}
                </span>
              )}
            </div>
            <p className="cell-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Generates a Stripe Checkout link for this shop to pay for the selected plan. Nothing
              changes here until the shop actually completes checkout.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <label className="field" style={{ flex: 1 }}>
                Plan
                <select value={billingTier} onChange={(e) => setBillingTier(e.target.value as PlanTier)}>
                  {PLAN_TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCopyBillingLink}
                disabled={generatingLink}
              >
                {linkCopied ? "Link copied!" : generatingLink ? "Generating…" : "Copy billing link"}
              </button>
            </div>
            {billingError && (
              <p className="form-error" style={{ marginTop: 8 }}>
                {billingError}
              </p>
            )}
            {linkCopied && linkMode === "dummy" && (
              <p className="cell-muted" style={{ marginTop: 8, fontSize: 13 }}>
                Stripe isn't configured yet, so this is a test link — opening it simulates a paid
                subscription without charging anything.
              </p>
            )}
          </div>
        )}

        <p className="section-label">Employees</p>
        <p className="cell-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Deactivating here works even for a shop's only admin, since it doesn't depend on that
          account still being able to act.
        </p>

        {employees === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {canDeactivate && <th></th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="cell-primary">{employee.name}</td>
                  <td className="cell-muted">{employee.email}</td>
                  <td className="cell-muted">{employee.role}</td>
                  <td>
                    <span className={`badge ${employee.active ? "badge-order-completed" : "badge-job-blocked"}`}>
                      {employee.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  {canDeactivate && (
                    <td>
                      {employee.active ? (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeactivate(employee.id)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleReactivate(employee.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
