import { useEffect, useState, type FormEvent } from "react";
import { uploadArtwork } from "../../api/files.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { Customer, NewOrderItemInput, OrderItem } from "../../types/index.js";

const emptyItem = (): NewOrderItemInput => ({
  signType: "",
  size: "",
  material: "",
  description: "",
  quantity: 1,
  price: 0,
  file: null,
});

export default function NewOrderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<NewOrderItemInput[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Customer[]>("/customers", { token })
      .then((list) => {
        setCustomers(list);
        if (list.length === 0) setCustomerMode("new");
      })
      .catch(console.error);
  }, [token]);

  function updateItem(index: number, patch: Partial<NewOrderItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (customerMode === "existing" && !customerId) {
      setError("Select a customer");
      return;
    }
    if (customerMode === "new" && !newCustomerName.trim()) {
      setError("Enter a customer name");
      return;
    }
    if (items.some((item) => !item.signType.trim() || item.price <= 0)) {
      setError("Every line item needs a sign type and a price greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const { order, items: createdItems } = await apiFetch<{ order: { id: string }; items: OrderItem[] }>(
        "/orders",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            customerId: customerMode === "existing" ? customerId : undefined,
            newCustomer:
              customerMode === "new"
                ? { name: newCustomerName, email: newCustomerEmail, phone: newCustomerPhone }
                : undefined,
            dueDate: dueDate || undefined,
            description: description || undefined,
            items: items.map(({ file: _file, ...rest }) => rest),
          }),
        }
      );

      // Items come back in the same order they were submitted, so we can
      // pair each local file with the server-assigned item id to upload.
      const uploads = items
        .map((item, i) => ({ file: item.file, itemId: createdItems[i]?.id }))
        .filter((u): u is { file: File; itemId: string } => !!u.file && !!u.itemId);
      await Promise.all(uploads.map((u) => uploadArtwork(u.file, order.id, u.itemId, token)));

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>New order</h2>
            <p className="cell-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Placing this order creates a queued production job for every line item.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="section-label">Customer</p>
          <div className="tab-toggle">
            <button
              type="button"
              className={customerMode === "existing" ? "active" : ""}
              onClick={() => setCustomerMode("existing")}
              disabled={customers.length === 0}
            >
              Existing
            </button>
            <button
              type="button"
              className={customerMode === "new" ? "active" : ""}
              onClick={() => setCustomerMode("new")}
            >
              New customer
            </button>
          </div>

          {customerMode === "existing" ? (
            <label className="field">
              Customer
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="field">
                Name
                <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              </label>
              <label className="field">
                Phone
                <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                Email
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                />
              </label>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
            <label className="field">
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="field">
              Order notes
              <input
                placeholder="Special instructions for the whole order…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>

          <p className="section-label">Line items</p>
          {items.map((item, i) => (
            <div className="item-card" key={i}>
              <div className="item-row">
                <input
                  placeholder="Storefront sign"
                  value={item.signType}
                  onChange={(e) => updateItem(i, { signType: e.target.value })}
                />
                <input
                  placeholder='24"x36"'
                  value={item.size}
                  onChange={(e) => updateItem(i, { size: e.target.value })}
                />
                <input
                  placeholder="Aluminum"
                  value={item.material}
                  onChange={(e) => updateItem(i, { material: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.price}
                  onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })}
                />
                <button
                  type="button"
                  className="item-row-remove"
                  onClick={() => removeItem(i)}
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
              <div className="item-card-footer">
                <input
                  className="item-description"
                  placeholder="Item description / production notes…"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                />
                <label className="file-input">
                  {item.file ? item.file.name : "Attach design file"}
                  <input
                    type="file"
                    onChange={(e) => updateItem(i, { file: e.target.files?.[0] ?? null })}
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
          >
            + Add item
          </button>

          <div className="order-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
