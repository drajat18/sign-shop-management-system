import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";

const router = Router();

// Admin only: manage employees, deactivate to instantly revoke access.
router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req, res) => {
  const users = await User.find().select("-passwordHash");
  res.json(users);
});

router.patch("/:id/deactivate", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

export default router;
