import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

const router = Router();

router.use(requireAuth);

// Nested populate so a job row carries the sign details and customer/due
// date it needs without a second round trip per job.
const JOB_POPULATE = {
  path: "orderItem",
  populate: { path: "order", populate: { path: "customer" } },
};

router.get("/", requireRole("admin", "manager", "production"), async (req, res) => {
  const { ProductionJob } = req.models!;
  const filter = req.auth!.role === "production" ? { assignedTo: req.auth!.userId } : {};
  const jobs = await ProductionJob.find(filter)
    .populate(JOB_POPULATE)
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 });
  res.json(jobs);
});

// Production updates status/notes on jobs assigned to them; managers/admins
// can also reassign — that's the one field production can't touch.
router.patch("/:id", requireRole("admin", "manager", "production"), async (req, res) => {
  const { ProductionJob, StatusLog } = req.models!;
  const job = await ProductionJob.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const isProduction = req.auth!.role === "production";
  if (isProduction && job.assignedTo?.toString() !== req.auth!.userId) {
    return res.status(403).json({ error: "Not assigned to this job" });
  }

  const updates = isProduction
    ? { status: req.body.status, notes: req.body.notes }
    : { status: req.body.status, notes: req.body.notes, assignedTo: req.body.assignedTo };

  const previousStatus = job.status;
  Object.assign(job, Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)));
  await job.save();
  await job.populate(JOB_POPULATE);
  await job.populate("assignedTo", "name");

  if (req.body.status && req.body.status !== previousStatus) {
    await StatusLog.create({
      entityType: "production_job",
      entityId: job._id,
      changedBy: req.auth!.userId,
      fromStatus: previousStatus,
      toStatus: job.status,
    });
  }
  emitToShop(req.auth!.shopId, EVENTS.JOB_UPDATED, job);

  res.json(job);
});

export default router;
