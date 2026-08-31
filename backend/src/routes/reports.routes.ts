import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePlanFeature } from "../middleware/requirePlanFeature.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// Matches the design doc's promise that Owner/Admin gets "reports" as part
// of full access — everyone else has no reason to see shop-wide financials.
// Growth plan and up — Starter doesn't include reporting.
router.use(requireAuth, requireRole("admin"), requirePlanFeature("reports"));

const AGING_BUCKETS = ["Not yet due", "1-30 days", "31-60 days", "61-90 days", "90+ days"] as const;

router.get("/summary", async (req, res) => {
  const { Order, OrderItem, ProductionJob } = req.models!;
  const { from, to } = req.query as { from?: string; to?: string };

  const createdAtFilter: Record<string, Date> = {};
  if (from) createdAtFilter.$gte = new Date(from);
  if (to) createdAtFilter.$lte = new Date(to);
  const rangeFilter = Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {};

  const orders = await Order.find(rangeFilter);
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const active = orders.filter((o) => o.status !== "cancelled");

  const totalOrders = active.length;
  const totalOrderValue = active.reduce((sum, o) => sum + o.total, 0);
  const amountCollected = active.reduce((sum, o) => sum + (o.amountPaid ?? 0), 0);
  const outstandingBalance = totalOrderValue - amountCollected;

  const ordersByStatus: Record<string, number> = {};
  for (const order of orders) {
    ordersByStatus[order.status ?? "new"] = (ordersByStatus[order.status ?? "new"] ?? 0) + 1;
  }

  const now = Date.now();
  const overdue = active.filter(
    (o) => o.dueDate && o.status !== "completed" && new Date(o.dueDate).getTime() < now && o.total > (o.amountPaid ?? 0)
  );
  const overdueDollarsTotal = overdue.reduce((sum, o) => sum + (o.total - (o.amountPaid ?? 0)), 0);

  // A/R aging — how long each unpaid/partial order's due date has been
  // behind it. Orders with no due date (only possible on pre-existing data
  // from before it became required) are left out rather than guessed at.
  const arAging: Record<(typeof AGING_BUCKETS)[number], number> = {
    "Not yet due": 0,
    "1-30 days": 0,
    "31-60 days": 0,
    "61-90 days": 0,
    "90+ days": 0,
  };
  for (const order of active) {
    const balance = order.total - (order.amountPaid ?? 0);
    if (balance <= 0 || !order.dueDate) continue;
    const daysPastDue = (now - new Date(order.dueDate).getTime()) / (1000 * 60 * 60 * 24);
    const bucket: (typeof AGING_BUCKETS)[number] =
      daysPastDue < 0
        ? "Not yet due"
        : daysPastDue <= 30
          ? "1-30 days"
          : daysPastDue <= 60
            ? "31-60 days"
            : daysPastDue <= 90
              ? "61-90 days"
              : "90+ days";
    arAging[bucket] += balance;
  }

  // No dedicated "completedAt" timestamp exists yet, so this approximates
  // turnaround as createdAt -> updatedAt for orders currently completed —
  // good enough for a first pass, not exact if a completed order was later
  // edited for an unrelated reason.
  const completedOrders = active.filter((o) => o.status === "completed");
  const avgTurnaroundDays = completedOrders.length
    ? completedOrders.reduce((sum, o) => {
        const created = o.createdAt as unknown as Date;
        const updated = o.updatedAt as unknown as Date;
        return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / completedOrders.length
    : null;

  // Revenue and estimated margin by sign type — items belonging to active
  // (non-cancelled) orders in range. Estimated cost leans on the same
  // simulated material-cost lookup used at order intake, so this is
  // directional, not a real books-grade margin — labeled as such for the
  // client to display honestly.
  const items = await OrderItem.find({ order: { $in: active.map((o) => o._id) } });
  const bySignType = new Map<string, { revenue: number; estimatedCost: number }>();
  let totalEstimatedCost = 0;
  for (const item of items) {
    const revenue = item.price * item.quantity;
    const cost = item.materialCostEstimate ?? 0;
    totalEstimatedCost += cost;
    const key = item.signType || "Uncategorized";
    const entry = bySignType.get(key) ?? { revenue: 0, estimatedCost: 0 };
    entry.revenue += revenue;
    entry.estimatedCost += cost;
    bySignType.set(key, entry);
  }
  const revenueBySignType = Array.from(bySignType.entries())
    .map(([signType, v]) => ({ signType, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const jobs = await ProductionJob.find({ assignedTo: { $ne: null } }).populate("assignedTo", "name");
  const jobCountByEmployee = new Map<string, { name: string; count: number }>();
  for (const job of jobs) {
    const assigned = job.assignedTo as unknown as { id: string; name: string } | null;
    if (!assigned) continue;
    const existing = jobCountByEmployee.get(assigned.id);
    if (existing) existing.count += 1;
    else jobCountByEmployee.set(assigned.id, { name: assigned.name, count: 1 });
  }

  res.json({
    totalOrders,
    totalOrderValue,
    amountCollected,
    outstandingBalance,
    cancelledOrders: cancelled.length,
    cancelledValue: cancelled.reduce((sum, o) => sum + o.total, 0),
    overdueDollarsTotal,
    overdueCount: overdue.length,
    estimatedMaterialCost: totalEstimatedCost,
    estimatedMargin: totalOrderValue - totalEstimatedCost,
    ordersByStatus,
    avgTurnaroundDays,
    revenueBySignType,
    arAging,
    jobsByEmployee: Array.from(jobCountByEmployee.values()).sort((a, b) => b.count - a.count),
  });
});

export default router;
