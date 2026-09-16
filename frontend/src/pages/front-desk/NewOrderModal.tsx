import { useEffect, useState, type FormEvent } from "react";
import { uploadArtwork } from "../../api/files.js";
import { apiFetch } from "../../api/client.js";
import { estimateMaterialCost } from "../../api/materialCost.js";
import { listMaterialStock } from "../../api/materialStock.js";
import { calculatePriceFromRule, findMatchingRule, listPricingRules } from "../../api/pricingRules.js";
import { useAuth } from "../../auth/AuthContext.js";
import CameraCaptureModal from "../../components/CameraCaptureModal.js";
import type {
  Customer,
  DuplicateOrderSeed,
  MaterialStock,
  NewOrderItemInput,
  OrderItem,
  PricingRule,
} from "../../types/index.js";

const emptyItem = (): NewOrderItemInput => ({
  signType: "",
  size: "",
  material: "",
  quantity: 1,
  price: 0,
  file: null,
});

export default function NewOrderModal({
  onClose,
  onCreated,
  duplicateFrom,
  isQuote,
}: {
  onClose: () => void;
  onCreated: () => void;
  duplicateFrom?: DuplicateOrderSeed;
  isQuote?: boolean;
}) {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState(duplicateFrom?.customerId ?? "");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [description, setDescription] = useState("");
  const [installRequired, setInstallRequired] = useState(false);
  const [installAddress, setInstallAddress] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [installCharge, setInstallCharge] = useState(0);
  const [discountType, setDiscountType] = useState<"" | "percent" | "flat">("");
  const [discountValue, setDiscountValue] = useState(0);
  const [items, setItems] = useState<NewOrderItemInput[]>(
    duplicateFrom ? duplicateFrom.items.map((i) => ({ ...i, file: null })) : [emptyItem()]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraTargetIndex, setCameraTargetIndex] = useState<number | null>(null);
  const [materialCostBusy, setMaterialCostBusy] = useState<number | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [materialStock, setMaterialStock] = useState<MaterialStock[]>([]);

  useEffect(() => {
    apiFetch<Customer[]>("/customers", { token })
      .then((list) => {
        setCustomers(list);
        if (list.length === 0) setCustomerMode("new");
      })
      .catch(console.error);
    listPricingRules(token).then(setPricingRules).catch(console.error);
    listMaterialStock(token).then(setMaterialStock).catch(console.error);
  }, [token]);

  function updateItem(index: number, patch: Partial<NewOrderItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleCheckPricing(index: number) {
    const item = items[index];
    if (!item.material?.trim()) return;
    setMaterialCostBusy(index);
    setError(null);
    try {
      const estimate = await estimateMaterialCost(
        { material: item.material, size: item.size, quantity: item.quantity },
        token
      );
      updateItem(index, { materialCostEstimate: estimate.totalCost, materialCostVendor: estimate.bestVendor });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check material pricing");
    } finally {
      setMaterialCostBusy(null);
    }
  }

  function handleCalculatePrice(index: number) {
    const item = items[index];
    const rule = findMatchingRule(pricingRules, item.signType);
    if (!rule) return;
    const price = calculatePriceFromRule(rule, {
      quantity: item.quantity,
      widthIn: item.widthIn,
      heightIn: item.heightIn,
      materialCostEstimate: item.materialCostEstimate,
    });
    if (price !== null) updateItem(index, { price });
  }

  const preDiscountTotal =
    items.reduce((sum, item) => sum + item.price * item.quantity, 0) + (installRequired ? installCharge : 0);
  const discountAmount = !discountType || discountValue <= 0
    ? 0
    : Math.min(
        Math.max(discountType === "percent" ? preDiscountTotal * (discountValue / 100) : discountValue, 0),
        preDiscountTotal
      );
  const total = preDiscountTotal - discountAmount;

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
    if (!isQuote && !dueDate) {
      setError("Due date is required");
      return;
    }
    if (items.some((item) => !item.signType.trim() || item.price <= 0)) {
      setError("Every line item needs a sign type and a price greater than 0");
      return;
    }
    if (installRequired && !installAddress.trim()) {
      setError("Enter the installation address, or uncheck “Needs installation”");
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
            installRequired,
            installAddress: installRequired ? installAddress : undefined,
            installDate: installRequired ? installDate || undefined : undefined,
            installCharge: installRequired ? installCharge : undefined,
            isQuote: Boolean(isQuote),
            validDays: isQuote ? validDays : undefined,
            discountType: discountType || undefined,
            discountValue: discountType ? discountValue : undefined,
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
      setError(err instanceof Error ? err.message : `Failed to create ${isQuote ? "quote" : "order"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isQuote ? "New quote" : "New order"}</h2>
            <p className="cell-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {isQuote
                ? "Nothing here reaches the shop floor or the customer until this quote is converted to an order."
                : "Placing this order creates a queued production job for every line item."}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="new-order-layout">
            <div className="new-order-sidebar">
              <p className="section-label" style={{ marginTop: 0 }}>
                Customer
              </p>
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
                <div style={{ display: "grid", gap: 12 }}>
                  <label className="field">
                    Name
                    <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                  </label>
                  <label className="field">
                    Phone
                    <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                  </label>
                  <label className="field">
                    Email
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <p className="section-label">{isQuote ? "Quote details" : "Order details"}</p>
              <div style={{ display: "grid", gap: 12 }}>
                <label className="field">
                  Due date{isQuote ? " (optional)" : ""}
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required={!isQuote}
                  />
                </label>
                {isQuote && (
                  <label className="field" style={{ maxWidth: 160 }}>
                    Valid for (days)
                    <input
                      type="number"
                      min={1}
                      value={validDays}
                      onChange={(e) => setValidDays(Number(e.target.value) || 30)}
                    />
                  </label>
                )}
                <label className="field">
                  {isQuote ? "Quote notes" : "Order notes"}
                  <input
                    placeholder="Special instructions for the whole order…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label className="field field-inline">
                  <input
                    type="checkbox"
                    checked={installRequired}
                    onChange={(e) => setInstallRequired(e.target.checked)}
                  />
                  Needs installation
                </label>
                {installRequired && (
                  <>
                    <label className="field">
                      Installation address
                      <input
                        placeholder="Site address where the sign will be installed"
                        value={installAddress}
                        onChange={(e) => setInstallAddress(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Install date
                      <input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
                    </label>
                    <label className="field">
                      Installation charge
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={installCharge}
                        onChange={(e) => setInstallCharge(Number(e.target.value) || 0)}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="new-order-main">
              <p className="section-label" style={{ marginTop: 0 }}>
                Line items
              </p>
              {items.map((item, i) => (
            <div className="item-card" key={i}>
              <div className="item-card-header">
                <span className="item-card-title">Item {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="item-row-remove"
                    onClick={() => removeItem(i)}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="item-grid-primary">
                <label className="field">
                  Sign type
                  <input
                    placeholder="Storefront sign"
                    value={item.signType}
                    onChange={(e) => updateItem(i, { signType: e.target.value })}
                  />
                </label>
                <label className="field">
                  Width (in)
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={item.widthIn ?? ""}
                    onChange={(e) => updateItem(i, { widthIn: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="field">
                  Height (in)
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={item.heightIn ?? ""}
                    onChange={(e) => updateItem(i, { heightIn: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="field">
                  Material
                  <input
                    placeholder="Aluminum"
                    value={item.material}
                    onChange={(e) => updateItem(i, { material: e.target.value })}
                    list={`material-options-${i}`}
                  />
                  <datalist id={`material-options-${i}`}>
                    {materialStock.map((m) => (
                      <option key={m.id} value={m.materialName} />
                    ))}
                  </datalist>
                </label>
                {materialStock.some((m) => m.materialName === item.material) && (
                  <label className="field">
                    Track against inventory
                    <select
                      value={item.materialStock ?? ""}
                      onChange={(e) => updateItem(i, { materialStock: e.target.value || undefined })}
                    >
                      <option value="">Don't deduct stock</option>
                      {materialStock
                        .filter((m) => m.materialName === item.material)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.materialName} ({m.quantityOnHand} {m.unit} on hand)
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                  />
                </label>
                <label className="field">
                  Price (per unit)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>

              <div className="field item-file-field">
                Pricing
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {findMatchingRule(pricingRules, item.signType) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleCalculatePrice(i)}
                    >
                      Calculate price
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleCheckPricing(i)}
                    disabled={!item.material?.trim() || materialCostBusy === i}
                  >
                    {materialCostBusy === i ? "Checking…" : "Check material cost"}
                  </button>
                  {item.materialCostEstimate !== undefined && (
                    <span className="cell-muted" style={{ fontSize: 13 }}>
                      Est. ${item.materialCostEstimate.toFixed(2)} (via {item.materialCostVendor} — simulated)
                    </span>
                  )}
                </div>
              </div>

              <div className="field item-description-field">
                Item description
                <textarea
                  className="item-description"
                  rows={2}
                  placeholder="Production notes for this specific item…"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                />
              </div>

              <div className="field item-file-field">
                Design file
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label className="file-input">
                    {item.file ? item.file.name : "Choose file…"}
                    <input
                      type="file"
                      onChange={(e) => updateItem(i, { file: e.target.files?.[0] ?? null })}
                    />
                  </label>
                  <button type="button" className="file-input" onClick={() => setCameraTargetIndex(i)}>
                    Take photo
                  </button>
                </div>
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

              {items.some((i) => i.materialCostEstimate !== undefined) && (
                <p className="cell-muted" style={{ fontSize: 13, marginTop: 12 }}>
                  Estimated material cost: $
                  {items.reduce((sum, i) => sum + (i.materialCostEstimate ?? 0), 0).toFixed(2)} (simulated)
                </p>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 12 }}>
                <label className="field" style={{ maxWidth: 160 }}>
                  Discount
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "" | "percent" | "flat")}
                  >
                    <option value="">None</option>
                    <option value="percent">Percent off</option>
                    <option value="flat">Flat amount off</option>
                  </select>
                </label>
                {discountType && (
                  <label className="field" style={{ maxWidth: 120 }}>
                    {discountType === "percent" ? "Percent" : "Amount ($)"}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    />
                  </label>
                )}
              </div>

              {discountAmount > 0 && (
                <div className="order-total" style={{ fontWeight: 400 }}>
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="order-total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : isQuote ? "Create quote" : "Create order"}
            </button>
          </div>
        </form>
      </div>

      {cameraTargetIndex !== null && (
        <CameraCaptureModal
          onCapture={(file) => updateItem(cameraTargetIndex, { file })}
          onClose={() => setCameraTargetIndex(null)}
        />
      )}
    </div>
  );
}
