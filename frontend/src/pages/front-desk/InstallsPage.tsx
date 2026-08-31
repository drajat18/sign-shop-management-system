import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { Order } from "../../types/index.js";
import OrderDetailModal from "./OrderDetailModal.js";

interface OrdersResponse {
  orders: Order[];
  total: number;
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < new Date().setHours(0, 0, 0, 0);
}

export default function InstallsPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  function loadInstalls() {
    const params = new URLSearchParams({
      installRequired: "true",
      sortBy: "installDate",
      sortDir: "asc",
      limit: "100",
    });
    apiFetch<OrdersResponse>(`/orders?${params.toString()}`, { token })
      .then((res) => setOrders(res.orders))
      .catch(console.error);
  }

  useEffect(loadInstalls, [token]);

  const scheduled = orders?.filter((o) => o.installDate) ?? [];
  const unscheduled = orders?.filter((o) => !o.installDate) ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Installs</h1>
          <p className="page-subtitle">Every order marked as needing installation, soonest first.</p>
        </div>
      </div>

      <div className="card">
        {orders === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No installs on the books</p>
            <p className="empty-state-body">Orders with "Needs installation" checked will show up here.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Install date</th>
                <th>Address</th>
                <th>Order status</th>
                <th>Install charge</th>
              </tr>
            </thead>
            <tbody>
              {[...scheduled, ...unscheduled].map((order) => (
                <tr key={order.id} onClick={() => setOpenOrderId(order.id)} style={{ cursor: "pointer" }}>
                  <td className="cell-primary">{order.customer?.name ?? "—"}</td>
                  <td
                    className={order.installDate && isPast(order.installDate) && order.status !== "completed" && order.status !== "cancelled" ? undefined : "cell-muted"}
                    style={
                      order.installDate && isPast(order.installDate) && order.status !== "completed" && order.status !== "cancelled"
                        ? { color: "var(--color-danger)", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {order.installDate ? new Date(order.installDate).toLocaleDateString() : "Not scheduled"}
                  </td>
                  <td className="cell-muted">{order.installAddress || "—"}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="cell-muted">{order.installCharge ? `$${order.installCharge.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openOrderId && (
        <OrderDetailModal
          orderId={openOrderId}
          editable
          onClose={() => setOpenOrderId(null)}
          onChanged={loadInstalls}
        />
      )}
    </div>
  );
}
