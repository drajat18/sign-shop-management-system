import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import FileRecord from "../models/FileRecord.js";
import { getProvider, type StorageProvider } from "../services/fileStorage/index.js";

const router = Router();

router.use(requireAuth, requireRole("admin", "manager", "front_desk"));

// Upload target ("internal" default, or "dropbox" if the checkbox is set)
// is chosen by the client and passed straight through to the storage layer.
router.post("/", async (req, res) => {
  const { fileName, orderId, storageProvider = "internal" } = req.body as {
    fileName: string;
    orderId: string;
    storageProvider?: StorageProvider;
  };

  const provider = await getProvider(storageProvider);
  const stored = await provider.upload(fileName, Buffer.from(req.body.data ?? "", "base64"));

  const record = await FileRecord.create({
    storageProvider: stored.storageProvider,
    filePath: stored.filePath,
    fileName: stored.fileName,
    order: orderId,
    uploadedBy: req.auth!.userId,
  });

  res.status(201).json(record);
});

router.get("/:id/download-url", async (req, res) => {
  const record = await FileRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ error: "File not found" });

  const provider = await getProvider(record.storageProvider as StorageProvider);
  const url = await provider.getDownloadUrl(record.filePath);
  res.json({ url });
});

export default router;
