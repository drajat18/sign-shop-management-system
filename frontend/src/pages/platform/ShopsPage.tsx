import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { usePlatformAuth } from "../../auth/PlatformAuthContext.js";
import { ROLE_LANDING_PAGE } from "../../auth/roles.js";
import type { PlanTier, Shop, User } from "../../types/index.js";
import ShopDetailModal from "./ShopDetailModal.js";

const PLAN_TIERS: { value: PlanTier; label: string }[] = [
  { value: "starter", label: "Starter — $59.99/mo" },
  { value: "growth", label: "Growth — $119.99/mo" },
  { value: "pro", label: "Pro — $199.99/mo" },
];

export default function ShopsPage() {
  const { token, user } = usePlatformAuth();
  const shopAuth = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [shopName, setShopName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [created, setCreated] = useState<{ adminEmail: string; adminPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openShop, setOpenShop] = useState<Shop | null>(null);
  const canCreate = user?.role === "owner" || user?.role === "onboarding";
  const canImpersonate = user?.role === "owner" || user?.role === "support";
  const canViewDetail = user?.role === "owner" || user?.role === "support";

  function loadShops() {
    apiFetch<Shop[]>("/platform/shops", { token }).then(setShops).catch(console.error);
  }

  useEffect(loadShops, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ adminEmail: string; adminPassword: string }>(
        "/platform/shops",
        {
          method: "POST",
          token,
          body: JSON.stringify({ shopName, adminEmail, adminName: adminName || undefined, planTier }),
        }
      );
      setCreated(result);
      setShopName("");
      setAdminEmail("");
      setAdminName("");
      setPlanTier("starter");
      loadShops();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shop");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImpersonate(shopId: string) {
    const result = await apiFetch<{ token: string; user: User; shop: { id: string; name: string } }>(
      `/platform/shops/${shopId}/impersonate`,
      { method: "POST", token }
    );
    shopAuth.login(result.user, result.token);
    navigate(ROLE_LANDING_PAGE[result.user.role]);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shops</h1>
          <p className="page-subtitle">Every shop provisioned on the platform.</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowCreate((v) => !v);
              setCreated(null);
            }}
          >
            {showCreate ? "Cancel" : "Create shop"}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          {created ? (
            <div>
              <p className="empty-state-title" style={{ marginBottom: 8 }}>
                Shop created
              </p>
              <p className="cell-muted" style={{ marginBottom: 4 }}>
                Admin login — share this with the shop once, it won't be shown again:
              </p>
              <p style={{ fontFamily: "monospace", fontSize: 13 }}>
                {created.adminEmail} / {created.adminPassword}
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label className="field">
                  Shop name
                  <input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
                </label>
                <label className="field">
                  Admin email
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  Admin name (optional)
                  <input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                </label>
                <label className="field">
                  Plan
                  <select value={planTier} onChange={(e) => setPlanTier(e.target.value as PlanTier)}>
                    {PLAN_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create shop"}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card">
        {shops === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading shops…</p>
          </div>
        ) : shops.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No shops yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Plan</th>
                <th>Subscription</th>
                <th>Created</th>
                {canImpersonate && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr
                  key={shop.id}
                  onClick={canViewDetail ? () => setOpenShop(shop) : undefined}
                  style={canViewDetail ? { cursor: "pointer" } : undefined}
                >
                  <td className="cell-primary">{shop.name}</td>
                  <td className="cell-muted">{shop.planTier}</td>
                  <td>
                    <span className={`badge ${shop.subscriptionStatus === "active" ? "badge-order-completed" : "badge-order-new"}`}>
                      {shop.subscriptionStatus}
                    </span>
                  </td>
                  <td className="cell-muted">{new Date(shop.createdAt).toLocaleDateString()}</td>
                  {canImpersonate && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImpersonate(shop.id);
                        }}
                      >
                        Impersonate
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {openShop && (
        <ShopDetailModal shopId={openShop.id} shopName={openShop.name} onClose={() => setOpenShop(null)} />
      )}
    </div>
  );
}
