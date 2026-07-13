import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import FileRecord from "../models/FileRecord.js";
import OrderItem from "../models/OrderItem.js";
import { getProvider, type StorageProvider } from "../services/fileStorage/index.js";
import { resolveUploadPath } from "../services/fileStorage/internalProvider.js";

const router = Router();

router.use(requireAuth);

// Upload target ("internal" default, or "dropbox" if the checkbox is set)
// is chosen by the client and passed straight through to the storage layer.
// Only roles that can edit orders can attach artwork.
router.post("/", requireRole("admin", "manager", "front_desk"), async (req, res) => {
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

  const provider = await getProvider(storageProvider);
  const stored = await provider.upload(fileName, Buffer.from(req.body.data ?? "", "base64"));

  const record = await FileRecord.create({
    storageProvider: stored.storageProvider,
    filePath: stored.filePath,
    fileName: stored.fileName,
    order: orderId,
    uploadedBy: req.auth!.userId,
  });

  if (orderItemId) {
    await OrderItem.findByIdAndUpdate(orderItemId, { artworkFile: record._id });
  }

  res.status(201).json(record);
});

// Production can view artwork on jobs they're working, so downloads are
// open to every authenticated role that can see orders/jobs at all.
router.get(
  "/:id/download-url",
  requireRole("admin", "manager", "front_desk", "production"),
  async (req, res) => {
    const record = await FileRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "File not found" });

    if (record.storageProvider === "internal") {
      return res.json({ url: `/api/files/${record.id}/raw`, fileName: record.fileName });
    }

    const provider = await getProvider(record.storageProvider as StorageProvider);
    const url = await provider.getDownloadUrl(record.filePath);
    res.json({ url, fileName: record.fileName });
  }
);

router.get("/:id/raw", requireRole("admin", "manager", "front_desk", "production"), async (req, res) => {
  const record = await FileRecord.findById(req.params.id);
  if (!record || record.storageProvider !== "internal") {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(resolveUploadPath(record.filePath), record.fileName);
});

export default router;
