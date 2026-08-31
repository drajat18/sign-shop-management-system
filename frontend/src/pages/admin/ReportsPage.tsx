import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { OrderStatus, ReportsSummary } from "../../types/index.js";

const STATUS_LABEL: Record<OrderStatus, string> = {
  quote: "Quote",
  new: "New",
  design_approval: "Design/Approval",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_ORDER: OrderStatus[] = [
  "quote",
  "new",
  "design_approval",
  "in_production",
  "ready_for_pickup",
  "completed",
  "cancelled",
];
const AGING_ORDER = ["Not yet due", "1-30 days", "31-60 days", "61-90 days", "90+ days"] as const;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p className="cell-muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700 }}>{value}</p>
      {hint && (
        <p className="cell-muted" style={{ fontSize: 11, marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    apiFetch<ReportsSummary>(`/reports/summary${qs ? `?${qs}` : ""}`, { token })
      .then(setSummary)
      .catch(console.error);
  }, [token, from, to]);

  function applyPreset(days: number | "all") {
    if (days === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(isoDate(start));
    setTo(isoDate(end));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Order volume, revenue, collections, and production activity.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ maxWidth: 180 }}>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ maxWidth: 180 }}>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => applyPreset(30)}>
            Last 30 days
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => applyPreset(90)}>
            Last 90 days
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => applyPreset("all")}>
            All time
          </button>
        </div>
      </div>

      {!summary ? (
        <div className="card empty-state">
          <p className="empty-state-body">Loading…</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
            <StatTile label="Total orders" value={String(summary.totalOrders)} hint={summary.cancelledOrders ? `${summary.cancelledOrders} cancelled, excluded` : undefined} />
            <StatTile label="Total order value" value={money(summary.totalOrderValue)} />
            <StatTile label="Collected" value={money(summary.amountCollected)} />
            <StatTile label="Outstanding balance" value={money(summary.outstandingBalance)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatTile
              label="Overdue & unpaid"
              value={money(summary.overdueDollarsTotal)}
              hint={`${summary.overdueCount} order${summary.overdueCount === 1 ? "" : "s"} past due`}
            />
            <StatTile
              label="Estimated margin"
              value={money(summary.estimatedMargin)}
              hint="Based on simulated material cost — directional, not a books figure"
            />
            <StatTile label="Estimated material cost" value={money(summary.estimatedMaterialCost)} hint="Simulated pricing" />
            <StatTile
              label="Avg. turnaround"
              value={summary.avgTurnaroundDays === null ? "—" : `${summary.avgTurnaroundDays.toFixed(1)} days`}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Orders by status</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {STATUS_ORDER.map((status) => {
                  const count = summary.ordersByStatus[status] ?? 0;
                  const maxStatusCount = Math.max(1, ...Object.values(summary.ordersByStatus));
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
                            background: status === "cancelled" ? "var(--color-text-faint)" : "var(--color-primary)",
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
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>A/R aging</h2>
              <p className="cell-muted" style={{ fontSize: 12, marginBottom: 16 }}>
                Unpaid balance, bucketed by days past the order's due date.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {AGING_ORDER.map((bucket) => (
                    <tr key={bucket}>
                      <td className="cell-primary">{bucket}</td>
                      <td className="cell-muted">{money(summary.arAging[bucket] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Revenue by sign type</h2>
              <p className="cell-muted" style={{ fontSize: 12, marginBottom: 16 }}>
                Top sign types by revenue, with estimated margin.
              </p>
              {summary.revenueBySignType.length === 0 ? (
                <p className="cell-muted" style={{ fontSize: 13 }}>
                  No order items in this range.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sign type</th>
                      <th>Revenue</th>
                      <th>Est. margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.revenueBySignType.map((row) => (
                      <tr key={row.signType}>
                        <td className="cell-primary">{row.signType}</td>
                        <td className="cell-muted">{money(row.revenue)}</td>
                        <td className="cell-muted">{money(row.revenue - row.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
        </>
      )}
    </div>
  );
}
