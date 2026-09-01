import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { DuplicateOrderSeed, Order } from "../../types/index.js";
import { formatDate } from "../../utils/date.js";
import NewOrderModal from "./NewOrderModal.js";
import OrderDetailModal from "./OrderDetailModal.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface OrdersResponse {
  orders: Order[];
  total: number;
}

export default function QuotesPage() {
  const { token, user } = useAuth();
  const [quotes, setQuotes] = useState<Order[] | null>(null);
  const [search, setSearch] = useState("");
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [duplicateSeed, setDuplicateSeed] = useState<DuplicateOrderSeed | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  function loadQuotes() {
    const params = new URLSearchParams({ status: "quote", sortBy: "createdAt", sortDir: "desc", limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    apiFetch<OrdersResponse>(`/orders?${params.toString()}`, { token })
      .then((res) => setQuotes(res.orders))
      .catch(console.error);
  }

  useEffect(loadQuotes, [token, search]);

  const loadQuotesRef = useRef(loadQuotes);
  loadQuotesRef.current = loadQuotes;

  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socket.on("order:created", () => loadQuotesRef.current());
    socket.on("order:updated", () => loadQuotesRef.current());
    return () => {
      socket.disconnect();
    };
  }, [token]);

  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "front_desk";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">
            Priced but not committed — nothing here has a production job or has been told anything by
            the shop.
          </p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNewQuote(true)}>
            New quote
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Search by customer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {quotes === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading quotes…</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No open quotes</p>
            <p className="empty-state-body">
              {search
                ? "Try clearing your search."
                : canEdit
                  ? "Price something for a customer who hasn't committed yet — it stays out of Orders and Production until you convert it."
                  : "Quotes will show up here once one's created."}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Items</th>
                <th>Created</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} onClick={() => setOpenOrderId(quote.id)} style={{ cursor: "pointer" }}>
                  <td className="cell-primary">{quote.customer?.name ?? "—"}</td>
                  <td className="cell-muted">{quote.itemsCount}</td>
                  <td className="cell-muted">
                    {quote.dueDate ? formatDate(quote.dueDate) : "—"}
                  </td>
                  <td className="cell-primary">${quote.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewQuote && (
        <NewOrderModal
          isQuote
          duplicateFrom={duplicateSeed ?? undefined}
          onClose={() => {
            setShowNewQuote(false);
            setDuplicateSeed(null);
          }}
          onCreated={() => {
            setShowNewQuote(false);
            setDuplicateSeed(null);
            loadQuotes();
          }}
        />
      )}

      {openOrderId && (
        <OrderDetailModal
          orderId={openOrderId}
          editable={canEdit}
          onClose={() => setOpenOrderId(null)}
          onChanged={loadQuotes}
          onDuplicate={(seed) => {
            setDuplicateSeed(seed);
            setOpenOrderId(null);
            setShowNewQuote(true);
          }}
        />
      )}
    </div>
  );
}
