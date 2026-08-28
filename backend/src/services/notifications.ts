import crypto from "node:crypto";
import type { Document, Types } from "mongoose";
import type { ShopModels } from "../models/shopModels.js";
import type { Customer } from "../models/Customer.js";
import type { Order } from "../models/Order.js";
import { getShopPlanTier, tierIncludes } from "./planLimits.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";

const PORTAL_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — matches orders.routes.ts

// Reuses (or creates) the same customer-portal link the "Copy customer
// link" button generates — respects the customer_portal plan gate the same
// way, so a notification email never hands a Starter-tier shop's customer
// a portal link that feature isn't paying for.
async function getPortalUrl(
  models: ShopModels,
  order: Document & { _id: Types.ObjectId },
  shopId: string
): Promise<string | null> {
  const planTier = await getShopPlanTier(shopId);
  if (!tierIncludes(planTier, "customer_portal")) return null;

  let tokenRecord = await models.CustomerPortalToken.findOne({
    order: order._id,
    expiresAt: { $gt: new Date() },
  });
  if (!tokenRecord) {
    tokenRecord = await models.CustomerPortalToken.create({
      order: order._id,
      token: crypto.randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + PORTAL_LINK_TTL_MS),
    });
  }
  return `${process.env.FRONTEND_URL}/portal/${shopId}/${tokenRecord.token}`;
}

// Callers fire these without awaiting (or await them for sequencing, since
// they never reject) — a slow or broken SMTP/Twilio provider should never
// hold up the request that triggered the notification. Each channel is
// attempted independently so one failing (or timing out) doesn't stop the
// other, or stop its own log entry from being written.
async function deliver(
  models: ShopModels,
  channel: "email" | "sms",
  send: () => Promise<void>,
  log: { to: string; subject?: string; body: string; trigger: string; order: Types.ObjectId | string }
): Promise<void> {
  try {
    await send();
  } catch (err) {
    console.error(`Failed to send ${channel} notification (trigger: ${log.trigger}):`, err);
  }
  try {
    await models.NotificationLog.create({ channel, ...log });
  } catch (err) {
    console.error(`Failed to write ${channel} notification log (trigger: ${log.trigger}):`, err);
  }
}

// Emails (and, if the customer has a phone on file, texts) a customer
// about their order — falls back to console-logging both channels when
// SMTP/Twilio aren't configured, same as every other integration here.
export async function notifyCustomer(
  models: ShopModels,
  shopId: string,
  order: Document & { _id: Types.ObjectId } & Order,
  customer: (Document & Customer) | null | undefined,
  { subject, text, trigger }: { subject: string; text: string; trigger: string }
): Promise<void> {
  if (!customer) return;

  let portalUrl: string | null = null;
  try {
    portalUrl = await getPortalUrl(models, order, shopId);
  } catch (err) {
    console.error(`Failed to resolve portal link (trigger: ${trigger}):`, err);
  }
  const fullText = portalUrl ? `${text}\n\nView your order: ${portalUrl}` : text;

  if (customer.email) {
    await deliver(models, "email", () => sendEmail({ to: customer.email!, subject, text: fullText }), {
      to: customer.email,
      subject,
      body: fullText,
      trigger,
      order: order._id,
    });
  }
  if (customer.phone) {
    await deliver(models, "sms", () => sendSms({ to: customer.phone!, body: fullText }), {
      to: customer.phone,
      body: fullText,
      trigger,
      order: order._id,
    });
  }
}

// Emails every active admin at the shop — used when a customer sends a
// message or otherwise needs staff attention. Admins don't have phone
// numbers on file today, so this is email-only.
export async function notifyShopAdmins(
  models: ShopModels,
  orderId: Types.ObjectId | string,
  { subject, text, trigger }: { subject: string; text: string; trigger: string }
): Promise<void> {
  const admins = await models.User.find({ role: "admin", active: true }).select("email");
  for (const admin of admins) {
    if (!admin.email) continue;
    await deliver(models, "email", () => sendEmail({ to: admin.email!, subject, text }), {
      to: admin.email,
      subject,
      body: text,
      trigger,
      order: orderId,
    });
  }
}
