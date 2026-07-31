import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// Matches the design doc's promise that Owner/Admin gets "reports" as part
// of full access — everyone else has no reason to see shop-wide financials.
router.use(requireAuth, requireRole("admin"));

router.get("/summary", async (req, res) => {
  const { Order, ProductionJob } = req.models!;

  const orders = await Order.find();
  const totalOrders = orders.length;
  const totalOrderValue = orders.reduce((sum, o) => sum + o.total, 0);
  const paidRevenue = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  const ordersByStatus: Record<string, number> = {};
  for (const order of orders) {
    ordersByStatus[order.status ?? "new"] = (ordersByStatus[order.status ?? "new"] ?? 0) + 1;
  }

  // No dedicated "completedAt" timestamp exists yet, so this approximates
  // turnaround as createdAt -> updatedAt for orders currently completed —
  // good enough for a first pass, not exact if a completed order was later
  // edited for an unrelated reason.
  const completedOrders = orders.filter((o) => o.status === "completed");
  const avgTurnaroundDays = completedOrders.length
    ? completedOrders.reduce((sum, o) => {
        const created = o.createdAt as unknown as Date;
        const updated = o.updatedAt as unknown as Date;
        return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / completedOrders.length
    : null;

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
    paidRevenue,
    ordersByStatus,
    avgTurnaroundDays,
    jobsByEmployee: Array.from(jobCountByEmployee.values()).sort((a, b) => b.count - a.count),
  });
});

export default router;
