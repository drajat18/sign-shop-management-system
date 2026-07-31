import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { PortalOrder } from "../../types/index.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function CustomerPortalPage() {
  const { shopId, token } = useParams<{ shopId: string; token: string }>();
  const [order, setOrder] = useState<PortalOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<PortalOrder>(`/portal/${shopId}/${token}`)
      .then((o) => {
        setOrder(o);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load order"));
  }

  useEffect(load, [shopId, token]);

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string }>(`/portal/${shopId}/${token}/approve`, {
        method: "POST",
      });
      setActionMessage(res.message);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string }>(`/portal/${shopId}/${token}/comment`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });
      setActionMessage(res.message);
      setComment("");
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send");
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

  if (!order) {
    return (
      <div className="auth-page">
        <p className="cell-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 60, paddingBottom: 60 }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
        </div>
        <h1 className="auth-title">Hi {order.customerName ?? "there"}</h1>
        <p className="auth-subtitle">Here's the latest on your order.</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <OrderStatusBadge status={order.status} />
          {order.dueDate && (
            <span className="cell-muted" style={{ fontSize: 13 }}>
              Due {new Date(order.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {order.description && (
          <p className="cell-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            {order.description}
          </p>
        )}

        {order.items.map((item) => (
          <div className="item-card" key={item.id}>
            <div className="item-card-header">
              <span className="item-card-title">{item.signType}</span>
            </div>
            <p className="cell-muted" style={{ fontSize: 13 }}>
              {[item.size, item.material].filter(Boolean).join(" · ") || "—"} · Qty {item.quantity}
            </p>
            {item.description && <p style={{ fontSize: 13, marginTop: 8 }}>{item.description}</p>}
            {item.artworkFile && (
              <a
                className="btn btn-outline btn-sm"
                style={{ marginTop: 12, display: "inline-flex" }}
                href={`${API_URL}/api/portal/${shopId}/${token}/files/${item.artworkFile.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View design: {item.artworkFile.fileName}
              </a>
            )}
          </div>
        ))}

        <div className="order-total">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        <p className="cell-muted" style={{ fontSize: 13, marginTop: 8 }}>
          Payment: {order.paymentStatus}
        </p>

        {actionMessage && (
          <p className="cell-muted" style={{ marginTop: 20, fontSize: 14 }}>
            {actionMessage}
          </p>
        )}
        {actionError && <p className="form-error">{actionError}</p>}

        {order.status === "design_approval" && !actionMessage && (
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleApprove}
              disabled={busy}
            >
              Approve design
            </button>
            <form onSubmit={handleComment} style={{ marginTop: 12 }}>
              <label className="field">
                Need changes? Tell us what to fix
                <textarea
                  className="item-description"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Please make the logo bigger…"
                />
              </label>
              <button
                type="submit"
                className="btn btn-outline btn-block"
                disabled={busy || !comment.trim()}
              >
                Request changes
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
