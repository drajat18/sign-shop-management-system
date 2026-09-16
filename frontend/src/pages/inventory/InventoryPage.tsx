import { useEffect, useState } from "react";
import {
  createMaterialStock,
  deleteMaterialStock,
  listMaterialStock,
  updateMaterialStock,
} from "../../api/materialStock.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { MaterialStock } from "../../types/index.js";

const emptyForm = {
  materialName: "",
  unit: "sqft",
  isAreaBased: false,
  quantityOnHand: 0,
  reorderThreshold: 0,
  vendorName: "",
  vendorContact: "",
  leadTimeDays: 0,
};

export default function InventoryPage() {
  const { token, user } = useAuth();
  const [stock, setStock] = useState<MaterialStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "manager";

  function load() {
    listMaterialStock(token).then(setStock).catch((err) => setError(err instanceof Error ? err.message : "Failed to load inventory"));
  }

  useEffect(load, [token]);

  async function handleAdd() {
    if (!form.materialName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createMaterialStock(form, token);
      setForm(emptyForm);
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(id: string, patch: Partial<MaterialStock>) {
    try {
      await updateMaterialStock(id, patch, token);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this material from inventory tracking?")) return;
    try {
      await deleteMaterialStock(id, token);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const lowStockCount = stock?.filter((s) => s.quantityOnHand <= s.reorderThreshold).length ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            How much of each material you have on hand — link an order item to a material here to
            deduct stock automatically.
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd((s) => !s)}>
            + Add material
          </button>
        )}
      </div>

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

      {lowStockCount > 0 && (
        <p className="cell-muted" style={{ marginBottom: 16, color: "var(--color-warning)" }}>
          {lowStockCount} material{lowStockCount === 1 ? "" : "s"} at or below its reorder threshold.
        </p>
      )}

      {showAdd && (
        <div className="item-card" style={{ marginBottom: 16 }}>
          <div className="item-grid-primary">
            <label className="field">
              Material
              <input
                placeholder="Aluminum composite"
                value={form.materialName}
                onChange={(e) => setForm({ ...form, materialName: e.target.value })}
              />
            </label>
            <label className="field">
              Unit
              <input
                placeholder="sqft, roll, sheet…"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>
            <label className="field">
              Quantity on hand
              <input
                type="number"
                min={0}
                value={form.quantityOnHand}
                onChange={(e) => setForm({ ...form, quantityOnHand: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="item-grid-primary">
            <label className="field">
              Reorder threshold
              <input
                type="number"
                min={0}
                value={form.reorderThreshold}
                onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="field">
              Vendor
              <input
                placeholder="Supplier name"
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              />
            </label>
            <label className="field">
              Vendor contact
              <input
                placeholder="Phone, email, or rep name"
                value={form.vendorContact}
                onChange={(e) => setForm({ ...form, vendorContact: e.target.value })}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
            <label className="field" style={{ maxWidth: 220 }}>
              Lead time (days)
              <input
                type="number"
                min={0}
                value={form.leadTimeDays}
                onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="field field-inline" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={form.isAreaBased}
                onChange={(e) => setForm({ ...form, isAreaBased: e.target.checked })}
              />
              Consumed by square footage, not per item
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd} disabled={busy}>
              {busy ? "Adding…" : "Add material"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {stock === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading…</p>
          </div>
        ) : stock.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No materials tracked yet</p>
            <p className="empty-state-body">
              {canManage ? "Add a material to start tracking stock." : "Nothing here yet."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th>By sqft</th>
                <th>On hand</th>
                <th>Reorder at</th>
                <th>Vendor</th>
                <th>Lead time</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {stock.map((item) => {
                const low = item.quantityOnHand <= item.reorderThreshold;
                return (
                  <tr key={item.id} style={low ? { background: "var(--color-warning-soft)" } : undefined}>
                    <td className="cell-primary">{item.materialName}</td>
                    <td className="cell-muted">{item.unit}</td>
                    <td>
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={item.isAreaBased ?? false}
                          onChange={(e) => handleUpdate(item.id, { isAreaBased: e.target.checked })}
                        />
                      ) : item.isAreaBased ? (
                        "Yes"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          style={{ width: 90 }}
                          defaultValue={item.quantityOnHand}
                          onBlur={(e) => {
                            const value = Number(e.target.value) || 0;
                            if (value !== item.quantityOnHand) handleUpdate(item.id, { quantityOnHand: value });
                          }}
                        />
                      ) : (
                        item.quantityOnHand
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          style={{ width: 90 }}
                          defaultValue={item.reorderThreshold}
                          onBlur={(e) => {
                            const value = Number(e.target.value) || 0;
                            if (value !== item.reorderThreshold) handleUpdate(item.id, { reorderThreshold: value });
                          }}
                        />
                      ) : (
                        item.reorderThreshold
                      )}
                    </td>
                    <td className="cell-muted">
                      {canManage ? (
                        <input
                          style={{ width: 140 }}
                          defaultValue={item.vendorName ?? ""}
                          placeholder="Vendor"
                          onBlur={(e) => {
                            if (e.target.value !== (item.vendorName ?? "")) {
                              handleUpdate(item.id, { vendorName: e.target.value });
                            }
                          }}
                        />
                      ) : (
                        item.vendorName || "—"
                      )}
                    </td>
                    <td className="cell-muted">
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          style={{ width: 70 }}
                          defaultValue={item.leadTimeDays ?? 0}
                          onBlur={(e) => {
                            const value = Number(e.target.value) || 0;
                            if (value !== (item.leadTimeDays ?? 0)) handleUpdate(item.id, { leadTimeDays: value });
                          }}
                        />
                      ) : (
                        item.leadTimeDays ? `${item.leadTimeDays}d` : "—"
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
