import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { Order } from "../../types/index.js";

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    apiFetch<Order[]>("/orders", { token }).then(setOrders).catch(console.error);
  }, [token]);

  return (
    <div>
      <h1>Orders</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.customer?.name} — {order.status} — ${order.total}
          </li>
        ))}
      </ul>
    </div>
  );
}
