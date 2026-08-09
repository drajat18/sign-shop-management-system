import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { EMAIL_CONFIGURED } from "../services/email.js";
import { SMS_CONFIGURED } from "../services/sms.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// A visible log of every notification sent (or dummy-logged) — the only
// way to confirm the feature is actually firing before real SMTP/Twilio
// credentials exist, same spirit as the dummy checkout/connect pages
// elsewhere in this app.
router.get("/", async (req, res) => {
  const { NotificationLog } = req.models!;
  const logs = await NotificationLog.find().sort({ createdAt: -1 }).limit(50);
  res.json({ emailConfigured: EMAIL_CONFIGURED, smsConfigured: SMS_CONFIGURED, logs });
});

export default router;
