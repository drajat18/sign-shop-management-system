import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "../../api/client.js";
import { bulkUpdateOrders, exportOrdersCsv } from "../../api/orders.js";
import { useAuth } from "../../auth/AuthContext.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { Order, OrderStatus } from "../../types/index.js";
import NewOrderModal from "./NewOrderModal.js";
import OrderDetailModal from "./OrderDetailModal.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 25;

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

type SortField = "createdAt" | "dueDate" | "total" | "status" | "paymentStatus";

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

export default function OrdersPage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("new");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (paymentFilter) params.set("paymentStatus", paymentFilter);
    return params;
  }

  function loadOrders() {
    const params = buildFilterParams();
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    apiFetch<OrdersResponse>(`/orders?${params.toString()}`, { token })
      .then((res) => {
        setOrders(res.orders);
        setTotal(res.total);
      })
      .catch(console.error);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatusUpdate() {
    setBulkBusy(true);
    setBulkError(null);
    try {
      await bulkUpdateOrders({ orderIds: Array.from(selectedIds), status: bulkStatus }, token);
      setSelectedIds(new Set());
      loadOrders();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to update orders");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleExport() {
    setExportBusy(true);
    setBulkError(null);
    try {
      await exportOrdersCsv(buildFilterParams(), token);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExportBusy(false);
    }
  }

  // Filters/sort/page changes all just re-run the query — reset back to
  // page 1 whenever a filter changes so you don't land on an empty page.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, paymentFilter, sortBy, sortDir]);

  useEffect(loadOrders, [token, search, statusFilter, paymentFilter, sortBy, sortDir, page]);

  // A selection only makes sense against the page/filters it was made on —
  // drop it whenever those change (but not on every live socket refresh of
  // the same page, which would otherwise wipe an in-progress selection).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, statusFilter, paymentFilter, sortBy, sortDir]);

  // The socket subscription only needs to happen once per token — kept in
  // a ref so its handlers always call the *current* loadOrders (with
  // whatever filters/page are active right now) instead of closing over
  // whatever they were on the first render.
  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  useEffect(() => {
    // Live updates so a status change made elsewhere (or a new order placed
    // from another front-desk terminal) shows up here without polling. The
    // token is required — the server uses it to put this connection in the
    // right shop's room so updates never cross tenant boundaries.
    const socket = io(API_URL, { auth: { token } });
    socket.on("order:created", () => loadOrdersRef.current());
    socket.on("order:updated", (updated: Order) => {
      setOrders((prev) => (prev ? prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) : prev));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "front_desk";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Track every order from intake through pickup.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNewOrder(true)}>
            New order
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {canEdit && (
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={exportBusy}>
            {exportBusy ? "Exporting…" : "Export CSV"}
          </button>
        )}
      </div>

      {bulkError && <p className="form-error" style={{ marginBottom: 16 }}>{bulkError}</p>}

      {canEdit && selectedIds.size > 0 && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="cell-primary" style={{ fontSize: 13 }}>
            {selectedIds.size} selected
          </span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleBulkStatusUpdate}
            disabled={bulkBusy}
          >
            {bulkBusy ? "Updating…" : "Set status"}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="card">
        {orders === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No orders found</p>
            <p className="empty-state-body">
              {search || statusFilter || paymentFilter
                ? "Try clearing your search or filters."
                : canEdit
                  ? "Create your first order to get started."
                  : "Orders will show up here once placed."}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {canEdit && (
                  <th>
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? new Set(orders.map((o) => o.id)) : new Set())
                      }
                    />
                  </th>
                )}
                <th>Customer</th>
                <th>Items</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("dueDate")}>
                  Due date{sortIndicator("dueDate")}
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("status")}>
                  Status{sortIndicator("status")}
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("paymentStatus")}>
                  Payment{sortIndicator("paymentStatus")}
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("total")}>
                  Total{sortIndicator("total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} onClick={() => setOpenOrderId(order.id)} style={{ cursor: "pointer" }}>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelected(order.id)}
                      />
                    </td>
                  )}
                  <td className="cell-primary">
                    {order.customer?.name ?? "—"}
                    {Boolean(order.unreadMessageCount) && (
                      <span className="badge badge-order-new" style={{ marginLeft: 8 }}>
                        {order.unreadMessageCount} new
                      </span>
                    )}
                  </td>
                  <td className="cell-muted">{order.itemsCount}</td>
                  <td className="cell-muted">
                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="cell-muted">{order.paymentStatus}</td>
                  <td className="cell-primary">${order.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {orders !== null && orders.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span className="cell-muted" style={{ fontSize: 13 }}>
            {total} order{total === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="cell-muted" style={{ fontSize: 13 }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showNewOrder && (
        <NewOrderModal
          onClose={() => setShowNewOrder(false)}
          onCreated={() => {
            setShowNewOrder(false);
            loadOrders();
          }}
        />
      )}

      {openOrderId && (
        <OrderDetailModal
          orderId={openOrderId}
          editable={canEdit}
          onClose={() => setOpenOrderId(null)}
          onChanged={loadOrders}
        />
      )}
    </div>
  );
}
