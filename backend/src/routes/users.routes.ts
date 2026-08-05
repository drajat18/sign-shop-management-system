import { Router } from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import ShopUserIndex from "../models/platform/ShopUserIndex.js";
import { EMPLOYEE_LIMITS, getShopPlanTier } from "../services/planLimits.js";
import { ROLES } from "../types/roles.js";

const router = Router();

router.use(requireAuth);

// Manager needs to know who's on production to reassign jobs, but
// full employee management (with email, active flag, create/deactivate)
// stays admin-only per the design doc.
router.get("/production", requireRole("admin", "manager"), async (req, res) => {
  const users = await req.models!.User.find({ role: "production", active: true }).select("name");
  res.json(users);
});

// Admin only from here down: manage employees, deactivate to instantly revoke access.
router.use(requireRole("admin"));

router.get("/", async (req, res) => {
  const users = await req.models!.User.find().select("-passwordHash").sort({ createdAt: -1 });
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

  const planTier = await getShopPlanTier(req.auth!.shopId);
  const seatLimit = EMPLOYEE_LIMITS[planTier];
  if (seatLimit !== null) {
    const activeCount = await req.models!.User.countDocuments({ active: true });
    if (activeCount >= seatLimit) {
      return res.status(403).json({
        error: `The ${planTier} plan is limited to ${seatLimit} active employees. Deactivate someone or upgrade to add more.`,
        upgradeRequired: true,
      });
    }
  }

  const normalizedEmail = email.toLowerCase();

  // Email identifies which shop a login belongs to platform-wide, so it
  // has to be unique across every shop, not just within this one.
  const existingIndex = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (existingIndex) {
    return res.status(409).json({ error: "That email is already in use on another account" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await req.models!.User.create({ name, email: normalizedEmail, passwordHash, role });
  await ShopUserIndex.create({ email: normalizedEmail, shopId: req.auth!.shopId });
  await req.models!.AuditLog.create({
    action: "employee_created",
    actorUserId: req.auth!.userId,
    targetId: user._id,
    metadata: { role },
  });

  const { passwordHash: _omit, ...safeUser } = user.toJSON();
  res.status(201).json(safeUser);
});

router.patch("/:id/deactivate", async (req, res) => {
  // Self-deactivation would be an instant, irreversible lockout if this
  // admin is the shop's only one — there's no self-serve reactivate flow.
  // Only the platform team can deactivate an admin's own account (via the
  // platform console), precisely because that path doesn't depend on the
  // account being deactivated still being able to act.
  if (req.params.id === req.auth!.userId) {
    return res.status(400).json({
      error: "You can't deactivate your own account. Contact platform support if this account needs to be deactivated.",
    });
  }

  const user = await req.models!.User.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  ).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });

  await req.models!.AuditLog.create({
    action: "employee_deactivated",
    actorUserId: req.auth!.userId,
    targetId: user._id,
  });

  res.json(user);
});

export default router;
