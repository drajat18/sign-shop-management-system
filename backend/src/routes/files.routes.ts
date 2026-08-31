import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getProvider, type StorageProvider } from "../services/fileStorage/index.js";
import { resolveUploadPath } from "../services/fileStorage/internalProvider.js";
import { getShopStorageLimitBytes, getShopStorageUsedBytes } from "../services/storageLimits.js";

const router = Router();

router.use(requireAuth);

// Upload target ("internal" default, or "dropbox" if the checkbox is set)
// is chosen by the client and passed straight through to the storage layer.
// Only roles that can edit orders can attach artwork.
router.post("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
  const { FileRecord, OrderItem } = req.models!;
  const {
    fileName,
    orderId,
    orderItemId,
    storageProvider = "internal",
  } = req.body as {
    fileName: string;
    orderId: string;
    orderItemId?: string;
    storageProvider?: StorageProvider;
  };

  if (!fileName || !orderId) {
    return res.status(400).json({ error: "fileName and orderId are required" });
  }

  const data = Buffer.from(req.body.data ?? "", "base64");

  // Only internal storage counts against the shop's quota — BYO Dropbox/
  // Google Drive uploads never hit this check regardless of tier.
  if (storageProvider === "internal") {
    const [usedBytes, limitBytes] = await Promise.all([
      getShopStorageUsedBytes(FileRecord),
      getShopStorageLimitBytes(req.auth!.shopId),
    ]);
    if (usedBytes + data.length > limitBytes) {
      const usedGb = (usedBytes / 1024 ** 3).toFixed(1);
      const limitGb = (limitBytes / 1024 ** 3).toFixed(0);
      return res.status(403).json({
        error: `This upload would exceed your storage limit (${usedGb} of ${limitGb} GB used). Upgrade your plan or buy more storage in Settings.`,
        upgradeRequired: true,
      });
    }
  }

  const provider = await getProvider(storageProvider);
  const stored = await provider.upload(fileName, data, req.auth!.shopId);

  const record = await FileRecord.create({
    storageProvider: stored.storageProvider,
    filePath: stored.filePath,
    fileName: stored.fileName,
    fileSize: data.length,
    order: orderId,
    orderItem: orderItemId,
    uploadedBy: req.auth!.userId,
  });

  if (orderItemId) {
    await OrderItem.findByIdAndUpdate(orderItemId, { artworkFile: record._id });
  }

  res.status(201).json(record);
});

// All files uploaded across every order for the shop, newest first — the
// storage gallery. Same role set as who can attach artwork in the first
// place, plus production (who can already view/download individual files).
router.get(
  "/",
  requireRole("admin", "manager", "front_desk", "production"),
  async (req, res) => {
    const { FileRecord } = req.models!;
    const [files, usedBytes, limitBytes] = await Promise.all([
      FileRecord.find()
        .sort({ createdAt: -1 })
        .populate({
          path: "order",
          select: "description status customer",
          populate: { path: "customer", select: "name" },
        })
        .populate("uploadedBy", "name"),
      getShopStorageUsedBytes(FileRecord),
      getShopStorageLimitBytes(req.auth!.shopId),
    ]);

    res.json({ files, usage: { usedBytes, limitBytes } });
  }
);

// Production can view artwork on jobs they're working, so downloads are
// open to every authenticated role that can see orders/jobs at all. Every
// provider knows how to turn a stored file into a fetchable URL — local
// disk proxies through our own /raw route, R2 hands back a signed URL the
// client fetches directly.
router.get(
  "/:id/download-url",
  requireRole("admin", "manager", "front_desk", "production"),
  async (req, res) => {
    const record = await req.models!.FileRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "File not found" });

    const provider = await getProvider(record.storageProvider as StorageProvider);
    const url = await provider.getDownloadUrl(record.filePath, record.id, req.auth!.shopId);
    res.json({ url, fileName: record.fileName });
  }
);

router.get("/:id/raw", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const record = await req.models!.FileRecord.findById(req.params.id);
  if (!record || record.storageProvider !== "internal") {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(resolveUploadPath(record.filePath), record.fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "File not found" });
    }
  });
});

export default router;
