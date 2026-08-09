import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getShopModels } from "../models/shopModels.js";
import Shop from "../models/platform/Shop.js";
import ShopUserIndex from "../models/platform/ShopUserIndex.js";
import { sendEmail } from "../services/email.js";
import { getShopConnection } from "../services/shopConnection.js";

const router = Router();
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Login is two-step because a user's actual credentials live inside their
// own shop's database, and all we have to start with is an email — the
// platform-level index below is what tells us which shop database to even
// look in before a password can be checked.
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const normalizedEmail = email.toLowerCase();

  const indexEntry = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (!indexEntry) {
    // No shop resolves for this email at all — nowhere to write an audit
    // entry, since audit logs are per-shop. Not attributable to any tenant.
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const shop = await Shop.findById(indexEntry.shopId);
  if (!shop || !shop.active) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const models = getShopModels(getShopConnection(shop.id));
  const user = await models.User.findOne({ email: normalizedEmail, active: true });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await models.AuditLog.create({ action: "login_failed", actorEmail: normalizedEmail });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { type: "shop", userId: user.id, role: user.role, shopId: shop.id },
    process.env.JWT_SECRET!,
    { expiresIn: "12h" }
  );

  await models.AuditLog.create({
    action: "login_success",
    actorUserId: user._id,
    actorEmail: normalizedEmail,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
    shop: { id: shop.id, name: shop.name },
  });
});

// Always responds the same way regardless of whether the email is known —
// otherwise this endpoint becomes a way to enumerate who has an account.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }
  const normalizedEmail = email.toLowerCase();
  const genericResponse = { message: "If that email has an account, a reset link has been sent." };

  const indexEntry = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (!indexEntry) return res.json(genericResponse);

  const shop = await Shop.findById(indexEntry.shopId);
  if (!shop || !shop.active) return res.json(genericResponse);

  const models = getShopModels(getShopConnection(shop.id));
  const user = await models.User.findOne({ email: normalizedEmail, active: true });
  if (!user) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString("base64url");
  await models.PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${rawToken}`;
  const subject = "Reset your Sign Shop password";
  const text = `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}`;
  await sendEmail({ to: normalizedEmail, subject, text });
  await models.NotificationLog.create({
    channel: "email",
    to: normalizedEmail,
    subject,
    body: text,
    trigger: "password_reset",
  });

  res.json(genericResponse);
});

router.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body as {
    email?: string;
    token?: string;
    newPassword?: string;
  };
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: "email, token, and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "newPassword must be at least 8 characters" });
  }

  const normalizedEmail = email.toLowerCase();
  const indexEntry = await ShopUserIndex.findOne({ email: normalizedEmail });
  if (!indexEntry) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const shop = await Shop.findById(indexEntry.shopId);
  if (!shop) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const models = getShopModels(getShopConnection(shop.id));
  const user = await models.User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const resetRecord = await models.PasswordResetToken.findOne({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!resetRecord) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Used token (and any other outstanding ones for this user) are now moot.
  await models.PasswordResetToken.deleteMany({ userId: user._id });
  await models.AuditLog.create({
    action: "password_reset",
    actorUserId: user._id,
    actorEmail: normalizedEmail,
  });

  res.json({ message: "Password updated — log in with your new password." });
});

export default router;
