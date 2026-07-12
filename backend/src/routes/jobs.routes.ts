import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import ProductionJob from "../models/ProductionJob.js";
import StatusLog from "../models/StatusLog.js";
import { EVENTS, getIO } from "../sockets/index.js";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole("admin", "manager", "production"), async (req, res) => {
  const filter = req.auth!.role === "production" ? { assignedTo: req.auth!.userId } : {};
  res.json(await ProductionJob.find(filter).populate("orderItem"));
});

// Production updates status/notes/materials on assigned jobs; managers can reassign.
router.patch("/:id", requireRole("admin", "manager", "production"), async (req, res) => {
  const job = await ProductionJob.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (req.auth!.role === "production" && job.assignedTo?.toString() !== req.auth!.userId) {
    return res.status(403).json({ error: "Not assigned to this job" });
  }

  const previousStatus = job.status;
  Object.assign(job, req.body);
  await job.save();

  if (req.body.status && req.body.status !== previousStatus) {
    await StatusLog.create({
      entityType: "production_job",
      entityId: job._id,
      changedBy: req.auth!.userId,
      fromStatus: previousStatus,
      toStatus: job.status,
    });
    getIO().emit(EVENTS.JOB_UPDATED, job);
  }

  res.json(job);
});

export default router;
