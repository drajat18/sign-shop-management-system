import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { OrderMessage, PortalOrder } from "../../types/index.js";
import { formatDate } from "../../utils/date.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function CustomerPortalPage() {
  const { shopId, token } = useParams<{ shopId: string; token: string }>();
  const [order, setOrder] = useState<PortalOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<OrderMessage[] | null>(null);
  const [messageBody, setMessageBody] = useState("");
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

  function loadMessages() {
    apiFetch<OrderMessage[]>(`/portal/${shopId}/${token}/messages`).then(setMessages).catch(console.error);
  }

  useEffect(load, [shopId, token]);
  useEffect(loadMessages, [shopId, token]);

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string }>(`/portal/${shopId}/${token}/approve`, {
        method: "POST",
      });
      setActionMessage(res.message);
      load();
      loadMessages();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/portal/${shopId}/${token}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: messageBody }),
      });
      setMessageBody("");
      loadMessages();
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
              Due {formatDate(order.dueDate)}
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

        {order.installRequired && (
          <div className="item-card" style={{ marginBottom: 16 }}>
            <div className="item-card-header">
              <span className="item-card-title">Installation</span>
            </div>
            <p className="cell-muted" style={{ fontSize: 13 }}>
              {order.installAddress || "Address to be confirmed"}
              {order.installDate ? ` · ${formatDate(order.installDate)}` : ""}
              {order.installCharge ? ` · $${order.installCharge.toFixed(2)} install charge` : ""}
            </p>
          </div>
        )}

        <div className="order-total">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        <p className="cell-muted" style={{ fontSize: 13, marginTop: 8 }}>
          Payment: {order.paymentStatus}
          {order.amountPaid ? ` · $${order.amountPaid.toFixed(2)} paid` : ""}
        </p>

        {actionError && <p className="form-error">{actionError}</p>}

        {order.status === "design_approval" && (
          <div style={{ marginTop: 20 }}>
            {actionMessage ? (
              <p className="cell-muted" style={{ fontSize: 14 }}>
                {actionMessage}
              </p>
            ) : (
              <button type="button" className="btn btn-primary btn-block" onClick={handleApprove} disabled={busy}>
                Approve design
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <p className="section-label">Messages</p>
          {messages === null ? (
            <p className="cell-muted" style={{ fontSize: 13 }}>
              Loading…
            </p>
          ) : messages.length === 0 ? (
            <p className="cell-muted" style={{ fontSize: 13 }}>
              No messages yet. Send us a note any time about this order.
            </p>
          ) : (
            <div className="message-thread">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`message-bubble ${m.sender === "customer" ? "message-bubble-staff" : "message-bubble-customer"}`}
                >
                  {m.body}
                  <span className="message-bubble-meta">
                    {m.sender === "customer" ? "You" : "Shop"} · {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Ask a question or leave a note…"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleSendMessage}
              disabled={busy || !messageBody.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
