import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { downloadArtwork, uploadArtwork } from "../../api/files.js";
import { useAuth } from "../../auth/AuthContext.js";
import { JobStatusBadge, OrderStatusBadge } from "../../components/StatusBadge.js";
import type { NewOrderItemInput, OrderDetail, OrderStatus } from "../../types/index.js";

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

const emptyItem = (): NewOrderItemInput => ({
  signType: "",
  size: "",
  material: "",
  description: "",
  quantity: 1,
  price: 0,
  file: null,
});

export default function OrderDetailModal({
  orderId,
  editable,
  onClose,
  onChanged,
}: {
  orderId: string;
  editable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<NewOrderItemInput>(emptyItem());
  const [busy, setBusy] = useState(false);

  function loadOrder() {
    apiFetch<OrderDetail>(`/orders/${orderId}`, { token })
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"));
  }

  useEffect(loadOrder, [orderId, token]);

  async function patchOrder(patch: Record<string, unknown>) {
    await apiFetch(`/orders/${orderId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
    loadOrder();
    onChanged();
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    await apiFetch(`/order-items/${itemId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
    loadOrder();
    onChanged();
  }

  async function removeItem(itemId: string) {
    if (!confirm("Remove this line item and its production job?")) return;
    await apiFetch(`/order-items/${itemId}`, { method: "DELETE", token });
    loadOrder();
    onChanged();
  }

  async function handleFileChange(itemId: string, file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadArtwork(file, orderId, itemId, token);
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem() {
    if (!newItem.signType.trim() || newItem.price <= 0) {
      setError("New item needs a sign type and a price greater than 0");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { item } = await apiFetch<{ item: { id: string } }>(`/orders/${orderId}/items`, {
        method: "POST",
        token,
        body: JSON.stringify(newItem),
      });
      if (newItem.file) {
        await uploadArtwork(newItem.file, orderId, item.id, token);
      }
      setNewItem(emptyItem());
      setShowAddItem(false);
      loadOrder();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!order ? (
          <p className="cell-muted">Loading order…</p>
        ) : (
          <>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{order.customer?.name}</h2>
                <p className="cell-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {order.customer?.email}
                  {order.customer?.email && order.customer?.phone ? " · " : ""}
                  {order.customer?.phone}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <label className="field">
                Status
                {editable ? (
                  <select
                    defaultValue={order.status}
                    onChange={(e) => patchOrder({ status: e.target.value })}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <OrderStatusBadge status={order.status} />
                )}
              </label>
              <label className="field">
                Payment
                {editable ? (
                  <select
                    defaultValue={order.paymentStatus}
                    onChange={(e) => patchOrder({ paymentStatus: e.target.value })}
                  >
                    {PAYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="cell-muted">{order.paymentStatus}</span>
                )}
              </label>
              <label className="field">
                Due date
                {editable ? (
                  <input
                    type="date"
                    defaultValue={order.dueDate ? order.dueDate.slice(0, 10) : ""}
                    onBlur={(e) => patchOrder({ dueDate: e.target.value || null })}
                  />
                ) : (
                  <span className="cell-muted">
                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "—"}
                  </span>
                )}
              </label>
            </div>

            <label className="field">
              Order notes
              {editable ? (
                <input
                  defaultValue={order.description ?? ""}
                  placeholder="Special instructions for the whole order…"
                  onBlur={(e) => patchOrder({ description: e.target.value })}
                />
              ) : (
                <span className="cell-muted">{order.description || "—"}</span>
              )}
            </label>

            <p className="section-label">Line items ({order.items.length})</p>
            {order.items.map((item, i) => (
              <div className="item-card" key={item.id}>
                <div className="item-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="item-card-title">Item {i + 1}</span>
                    {item.job && <JobStatusBadge status={item.job.status} />}
                  </div>
                  {editable && (
                    <button
                      type="button"
                      className="item-row-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  )}
                </div>

                {editable ? (
                  <>
                    <div className="item-grid-primary">
                      <label className="field">
                        Sign type
                        <input
                          defaultValue={item.signType}
                          onBlur={(e) => e.target.value !== item.signType && patchItem(item.id, { signType: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Size
                        <input
                          defaultValue={item.size ?? ""}
                          placeholder="Size"
                          onBlur={(e) => e.target.value !== (item.size ?? "") && patchItem(item.id, { size: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Material
                        <input
                          defaultValue={item.material ?? ""}
                          placeholder="Material"
                          onBlur={(e) => e.target.value !== (item.material ?? "") && patchItem(item.id, { material: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="item-grid-secondary">
                      <label className="field">
                        Quantity
                        <input
                          type="number"
                          min={1}
                          defaultValue={item.quantity}
                          onBlur={(e) => Number(e.target.value) !== item.quantity && patchItem(item.id, { quantity: Number(e.target.value) || 1 })}
                        />
                      </label>
                      <label className="field">
                        Price (per unit)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={item.price}
                          onBlur={(e) => Number(e.target.value) !== item.price && patchItem(item.id, { price: Number(e.target.value) || 0 })}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="item-grid-primary">
                    <div>
                      <p className="cell-muted" style={{ fontSize: 12, marginBottom: 2 }}>
                        Sign type
                      </p>
                      <p className="cell-primary" style={{ fontSize: 14 }}>
                        {item.signType}
                      </p>
                    </div>
                    <div>
                      <p className="cell-muted" style={{ fontSize: 12, marginBottom: 2 }}>
                        Size
                      </p>
                      <p style={{ fontSize: 14 }}>{item.size || "—"}</p>
                    </div>
                    <div>
                      <p className="cell-muted" style={{ fontSize: 12, marginBottom: 2 }}>
                        Material
                      </p>
                      <p style={{ fontSize: 14 }}>{item.material || "—"}</p>
                    </div>
                  </div>
                )}
                {!editable && (
                  <p className="cell-muted" style={{ fontSize: 13, marginTop: 12 }}>
                    Qty {item.quantity} · ${item.price.toFixed(2)} each
                  </p>
                )}

                <div className="field item-description-field">
                  Item description
                  {editable ? (
                    <textarea
                      className="item-description"
                      rows={2}
                      defaultValue={item.description ?? ""}
                      placeholder="Production notes for this specific item…"
                      onBlur={(e) =>
                        e.target.value !== (item.description ?? "") &&
                        patchItem(item.id, { description: e.target.value })
                      }
                    />
                  ) : (
                    <span className="cell-muted" style={{ fontSize: 13 }}>
                      {item.description || "—"}
                    </span>
                  )}
                </div>

                <div className="field item-file-field">
                  Design file
                  <div>
                    {item.artworkFile ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => downloadArtwork(item.artworkFile!.id, item.artworkFile!.fileName, token)}
                      >
                        Download {item.artworkFile.fileName}
                      </button>
                    ) : editable ? (
                      <label className="file-input">
                        {busy ? "Uploading…" : "Choose file…"}
                        <input
                          type="file"
                          disabled={busy}
                          onChange={(e) => handleFileChange(item.id, e.target.files?.[0] ?? null)}
                        />
                      </label>
                    ) : (
                      <span className="cell-muted" style={{ fontSize: 13 }}>
                        No file attached
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {editable && !showAddItem && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddItem(true)}>
                + Add item
              </button>
            )}

            {editable && showAddItem && (
              <div className="item-card">
                <div className="item-card-header">
                  <span className="item-card-title">New item</span>
                </div>

                <div className="item-grid-primary">
                  <label className="field">
                    Sign type
                    <input
                      placeholder="Storefront sign"
                      value={newItem.signType}
                      onChange={(e) => setNewItem({ ...newItem, signType: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Size
                    <input
                      placeholder='24"x36"'
                      value={newItem.size}
                      onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Material
                    <input
                      placeholder="Aluminum"
                      value={newItem.material}
                      onChange={(e) => setNewItem({ ...newItem, material: e.target.value })}
                    />
                  </label>
                </div>

                <div className="item-grid-secondary">
                  <label className="field">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label className="field">
                    Price (per unit)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>

                <div className="field item-description-field">
                  Item description
                  <textarea
                    className="item-description"
                    rows={2}
                    placeholder="Production notes for this specific item…"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                </div>

                <div className="field item-file-field">
                  Design file
                  <div>
                    <label className="file-input">
                      {newItem.file ? newItem.file.name : "Choose file…"}
                      <input
                        type="file"
                        onChange={(e) => setNewItem({ ...newItem, file: e.target.files?.[0] ?? null })}
                      />
                    </label>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddItem(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddItem} disabled={busy}>
                    Add item
                  </button>
                </div>
              </div>
            )}

            <div className="order-total">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>

            {error && <p className="form-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
