import { Router } from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";
import { ROLES } from "../types/roles.js";

const router = Router();

router.use(requireAuth);

// Manager needs to know who's on production to reassign jobs, but
// full employee management (with email, active flag, create/deactivate)
// stays admin-only per the design doc.
router.get("/production", requireRole("admin", "manager"), async (_req, res) => {
  const users = await User.find({ role: "production", active: true }).select("name");
  res.json(users);
});

// Admin only from here down: manage employees, deactivate to instantly revoke access.
router.use(requireRole("admin"));

router.get("/", async (_req, res) => {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json(users);
});

// The only way employee accounts get created in this app — no public
// signup. An Admin sets a temp password here and shares it with the
// new hire out of band; nothing self-registers.
router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, and role are required" });
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(", ")}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash, role });

  const { passwordHash: _omit, ...safeUser } = user.toJSON();
  res.status(201).json(safeUser);
});

router.patch("/:id/deactivate", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

export default router;
