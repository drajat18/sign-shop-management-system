import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { Order } from "../../types/index.js";
import { formatDate, isDateOnlyPast } from "../../utils/date.js";
import OrderDetailModal from "./OrderDetailModal.js";

interface OrdersResponse {
  orders: Order[];
  total: number;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InstallsPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

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

  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of scheduled) {
      // installDate is a date-only value stored as UTC midnight — read the
      // Y-M-D straight off the ISO string instead of building a local Date
      // from it, or a viewer west of UTC would see every install shifted
      // back one day on the calendar (Aug 27 UTC midnight is still Aug 26
      // evening in, say, US timezones).
      const key = order.installDate!.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return map;
  }, [scheduled]);

  // A 6x7 grid covering the full month plus enough of the neighboring
  // months to fill complete weeks — a fixed 42-cell grid never reflows
  // between months with 4 vs 6 weeks.
  const calendarDays = useMemo(() => {
    const firstOfMonth = monthCursor;
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monthCursor]);

  async function rescheduleTo(orderId: string, day: Date) {
    setRescheduleError(null);
    try {
      await apiFetch(`/orders/${orderId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ installDate: dateKey(day) }),
      });
      loadInstalls();
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Failed to reschedule");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Installs</h1>
          <p className="page-subtitle">Every order marked as needing installation, soonest first.</p>
        </div>
        <div className="tab-toggle">
          <button type="button" className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>
            Calendar
          </button>
          <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            List
          </button>
        </div>
      </div>

      {rescheduleError && <p className="form-error" style={{ marginBottom: 16 }}>{rescheduleError}</p>}

      {view === "calendar" ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              Previous
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>
              {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              Next
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--color-border)", border: "1px solid var(--color-border)" }}>
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="cell-muted" style={{ background: "var(--color-surface)", padding: "6px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const dayOrders = ordersByDay.get(key) ?? [];
              const isToday = key === dateKey(new Date());
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDay(key);
                  }}
                  onDragLeave={() => setDragOverDay((d) => (d === key ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDay(null);
                    const orderId = e.dataTransfer.getData("text/plain");
                    if (orderId) rescheduleTo(orderId, day);
                  }}
                  style={{
                    background: dragOverDay === key ? "var(--color-primary-soft)" : "var(--color-surface)",
                    minHeight: 96,
                    padding: 6,
                    opacity: inMonth ? 1 : 0.45,
                  }}
                >
                  <div
                    className="cell-muted"
                    style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--color-primary)" : undefined, marginBottom: 4 }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {dayOrders.map((order) => (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", order.id)}
                        onClick={() => setOpenOrderId(order.id)}
                        style={{
                          cursor: "grab",
                          fontSize: 11.5,
                          background: "var(--color-primary-soft)",
                          color: "var(--color-primary)",
                          borderRadius: 4,
                          padding: "3px 6px",
                        }}
                        title={order.installAssignedTo ? `Assigned: ${order.installAssignedTo.name}` : "Unassigned"}
                      >
                        {order.customer?.name ?? "—"}
                        {order.installAssignedTo && (
                          <span style={{ opacity: 0.75 }}> · {order.installAssignedTo.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {unscheduled.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="section-label">Not scheduled yet ({unscheduled.length})</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {unscheduled.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", order.id)}
                    onClick={() => setOpenOrderId(order.id)}
                    className="cell-muted"
                    style={{
                      cursor: "grab",
                      fontSize: 12.5,
                      background: "var(--color-neutral-soft)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {order.customer?.name ?? "—"}
                  </div>
                ))}
              </div>
              <p className="cell-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Drag onto a date to schedule, or open one to set it directly.
              </p>
            </div>
          )}
        </div>
      ) : (
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
            <div className="table-wrap">
              <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Install date</th>
                  <th>Assigned to</th>
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
                      className={order.installDate && isDateOnlyPast(order.installDate) && order.status !== "completed" && order.status !== "cancelled" ? undefined : "cell-muted"}
                      style={
                        order.installDate && isDateOnlyPast(order.installDate) && order.status !== "completed" && order.status !== "cancelled"
                          ? { color: "var(--color-danger)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {order.installDate ? formatDate(order.installDate) : "Not scheduled"}
                    </td>
                    <td className="cell-muted">{order.installAssignedTo?.name ?? "—"}</td>
                    <td className="cell-muted">{order.installAddress || "—"}</td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="cell-muted">{order.installCharge ? `$${order.installCharge.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
