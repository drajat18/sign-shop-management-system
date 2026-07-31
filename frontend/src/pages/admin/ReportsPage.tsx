import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { OrderStatus, ReportsSummary } from "../../types/index.js";

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  design_approval: "Design/Approval",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
};
const STATUS_ORDER: OrderStatus[] = [
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p className="cell-muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);

  useEffect(() => {
    apiFetch<ReportsSummary>("/reports/summary", { token }).then(setSummary).catch(console.error);
  }, [token]);

  if (!summary) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Order volume, revenue, and production activity.</p>
          </div>
        </div>
        <div className="card empty-state">
          <p className="empty-state-body">Loading…</p>
        </div>
      </div>
    );
  }

  const maxStatusCount = Math.max(1, ...Object.values(summary.ordersByStatus));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Order volume, revenue, and production activity.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatTile label="Total orders" value={String(summary.totalOrders)} />
        <StatTile label="Total order value" value={`$${summary.totalOrderValue.toFixed(2)}`} />
        <StatTile label="Paid revenue" value={`$${summary.paidRevenue.toFixed(2)}`} />
        <StatTile
          label="Avg. turnaround"
          value={summary.avgTurnaroundDays === null ? "—" : `${summary.avgTurnaroundDays.toFixed(1)} days`}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Orders by status</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STATUS_ORDER.map((status) => {
              const count = summary.ordersByStatus[status] ?? 0;
              return (
                <div key={status}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{STATUS_LABEL[status]}</span>
                    <span className="cell-muted">{count}</span>
                  </div>
                  <div style={{ background: "var(--color-neutral-soft)", borderRadius: 999, height: 8 }}>
                    <div
                      style={{
                        width: `${(count / maxStatusCount) * 100}%`,
                        background: "var(--color-primary)",
                        borderRadius: 999,
                        height: 8,
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Jobs by employee</h2>
          {summary.jobsByEmployee.length === 0 ? (
            <p className="cell-muted" style={{ fontSize: 13 }}>
              No jobs assigned yet.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Jobs</th>
                </tr>
              </thead>
              <tbody>
                {summary.jobsByEmployee.map((row) => (
                  <tr key={row.name}>
                    <td className="cell-primary">{row.name}</td>
                    <td className="cell-muted">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
