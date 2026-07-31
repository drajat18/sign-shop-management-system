import { Router } from "express";
import { resolvePortalShop } from "../middleware/portalContext.js";
import type { ShopModels } from "../models/shopModels.js";
import { getProvider, type StorageProvider } from "../services/fileStorage/index.js";
import { resolveUploadPath } from "../services/fileStorage/internalProvider.js";
import { EVENTS, emitToShop } from "../sockets/index.js";

// Entirely public — no login, no employee account. The token itself (a
// random 32-byte value baked into the link) is the only credential, scoped
// to exactly one order. Mounted at /api/portal/:shopId so every route here
// can resolve which shop's database to query.
// mergeParams pulls shopId in from the parent mount at runtime
// (app.use("/api/portal/:shopId", ...)) — Express's types can't infer that
// from this router's own route strings, so it's cast at each usage below.
const router = Router({ mergeParams: true });
router.use(resolvePortalShop);

async function findOrderByToken(models: ShopModels, token: string) {
  const tokenRecord = await models.CustomerPortalToken.findOne({ token, expiresAt: { $gt: new Date() } });
  if (!tokenRecord) return null;
  const order = await models.Order.findById(tokenRecord.order);
  return order;
}

router.get("/:token", async (req, res) => {
  const models = req.portalModels!;
  const order = await findOrderByToken(models, req.params.token);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });

  const customer = await models.Customer.findById(order.customer);
  const items = await models.OrderItem.find({ order: order._id }).populate("artworkFile");

  res.json({
    id: order.id,
    customerName: customer?.name,
    status: order.status,
    dueDate: order.dueDate,
    description: order.description,
    total: order.total,
    paymentStatus: order.paymentStatus,
    customerComment: order.customerComment,
    items: items.map((item) => item.toJSON()),
  });
});

// Viewing the design is the whole point of a "design approval" step, so
// artwork needs to be reachable without a shop login too — scoped strictly
// to files that belong to *this* order, verified via the FileRecord's own
// order reference rather than trusting the fileId alone.
router.get("/:token/files/:fileId", async (req, res) => {
  const models = req.portalModels!;
  const order = await findOrderByToken(models, req.params.token);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });

  const file = await models.FileRecord.findById(req.params.fileId);
  if (!file || file.order.toString() !== order.id) {
    return res.status(404).json({ error: "File not found" });
  }

  const shopId = (req.params as unknown as { shopId: string }).shopId;
  const provider = await getProvider(file.storageProvider as StorageProvider);
  const url = await provider.getDownloadUrl(file.filePath, file.id, shopId);
  if (url.startsWith("http")) {
    // R2 signed URL — send the browser straight there.
    return res.redirect(url);
  }
  // Local disk — stream it ourselves since that path isn't a real URL.
  res.download(resolveUploadPath(file.filePath), file.fileName, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "File not found" });
  });
});

router.post("/:token/approve", async (req, res) => {
  const models = req.portalModels!;
  const order = await findOrderByToken(models, req.params.token);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });
  if (order.status !== "design_approval") {
    return res.status(400).json({ error: "This order isn't waiting on design approval right now." });
  }

  order.status = "in_production";
  order.customerComment = undefined;
  order.customerResponseType = "approved";
  await order.save();

  await models.AuditLog.create({
    action: "customer_approved_design",
    targetId: order._id,
  });
  await order.populate("customer");
  emitToShop((req.params as unknown as { shopId: string }).shopId, EVENTS.ORDER_UPDATED, order);

  res.json({ message: "Design approved — thank you! We'll get started on production." });
});

router.post("/:token/comment", async (req, res) => {
  const { comment } = req.body as { comment?: string };
  if (!comment?.trim()) {
    return res.status(400).json({ error: "comment is required" });
  }

  const models = req.portalModels!;
  const order = await findOrderByToken(models, req.params.token);
  if (!order) return res.status(404).json({ error: "This link is invalid or has expired." });

  order.customerComment = comment.trim();
  order.customerResponseType = "changes_requested";
  await order.save();

  await models.AuditLog.create({
    action: "customer_comment",
    targetId: order._id,
    metadata: { comment: comment.trim() },
  });
  await order.populate("customer");
  emitToShop((req.params as unknown as { shopId: string }).shopId, EVENTS.ORDER_UPDATED, order);

  res.json({ message: "Thanks — we've received your note and will follow up." });
});

export default router;
