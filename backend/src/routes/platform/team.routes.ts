import { Router } from "express";
import bcrypt from "bcrypt";
import { requirePlatformAuth } from "../../middleware/platformAuth.js";
import { requirePlatformRole } from "../../middleware/requirePlatformRole.js";
import PlatformUser from "../../models/platform/PlatformUser.js";
import { PLATFORM_ROLES } from "../../types/platformRoles.js";

const router = Router();

// Owner only: this is your internal team, not a shop's employees.
router.use(requirePlatformAuth, requirePlatformRole("owner"));

router.get("/", async (_req, res) => {
  const users = await PlatformUser.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json(users);
});

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
  if (!PLATFORM_ROLES.includes(role as (typeof PLATFORM_ROLES)[number])) {
    return res.status(400).json({ error: `role must be one of: ${PLATFORM_ROLES.join(", ")}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await PlatformUser.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: "That email is already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await PlatformUser.create({ name, email: normalizedEmail, passwordHash, role });
  const { passwordHash: _omit, ...safeUser } = user.toJSON();
  res.status(201).json(safeUser);
});

router.patch("/:id/deactivate", async (req, res) => {
  const user = await PlatformUser.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  ).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

export default router;
