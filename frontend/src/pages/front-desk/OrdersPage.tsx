import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { Order } from "../../types/index.js";
import NewOrderModal from "./NewOrderModal.js";
import OrderDetailModal from "./OrderDetailModal.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function OrdersPage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  function loadOrders() {
    apiFetch<Order[]>("/orders", { token }).then(setOrders).catch(console.error);
  }

  useEffect(() => {
    loadOrders();

    // Live updates so a status change made elsewhere (or a new order placed
    // from another front-desk terminal) shows up here without polling. The
    // token is required — the server uses it to put this connection in the
    // right shop's room so updates never cross tenant boundaries.
    const socket = io(API_URL, { auth: { token } });
    socket.on("order:created", () => loadOrders());
    socket.on("order:updated", (updated: Order) => {
      setOrders((prev) => (prev ? prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) : prev));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "front_desk";

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

      <div className="card">
        {orders === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No orders yet</p>
            <p className="empty-state-body">
              {canEdit ? "Create your first order to get started." : "Orders will show up here once placed."}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Items</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} onClick={() => setOpenOrderId(order.id)} style={{ cursor: "pointer" }}>
                  <td className="cell-primary">{order.customer?.name ?? "—"}</td>
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
