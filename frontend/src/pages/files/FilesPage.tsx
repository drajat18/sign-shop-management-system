import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { downloadArtwork, getDownloadUrl, listFiles } from "../../api/files.js";
import { useAuth } from "../../auth/AuthContext.js";
import { OrderStatusBadge } from "../../components/StatusBadge.js";
import type { FileGalleryItem, FileGalleryResponse } from "../../types/index.js";
import { formatBytes } from "../../utils/bytes.js";

const PROVIDER_LABEL: Record<FileGalleryItem["storageProvider"], string> = {
  internal: "Internal",
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

// Every design file uploaded across every order for the shop, in one place
// — the "how much storage have we used" view that the per-order attach UI
// doesn't surface on its own.
export default function FilesPage() {
  const { token } = useAuth();
  const [data, setData] = useState<FileGalleryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  function load() {
    listFiles(token).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Failed to load files"));
  }

  useEffect(load, [token]);

  async function handleOpen(file: FileGalleryItem) {
    setBusyFileId(file.id);
    try {
      if (file.storageProvider === "internal") {
        await downloadArtwork(file.id, file.fileName, token);
      } else {
        const { url } = await getDownloadUrl(file.id, token);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
    } finally {
      setBusyFileId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">Every design file uploaded across all your orders.</p>
        </div>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

      {data === null ? (
        <p className="cell-muted">Loading…</p>
      ) : (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Internal storage used</span>
              <span className="cell-muted" style={{ fontSize: 13 }}>
                {formatBytes(data.usage.usedBytes)} / {formatBytes(data.usage.limitBytes)}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--color-border)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (data.usage.usedBytes / Math.max(1, data.usage.limitBytes)) * 100)}%`,
                  background: "var(--color-primary)",
                }}
              />
            </div>
            <p className="cell-muted" style={{ fontSize: 13, marginTop: 8 }}>
              Files stored in Dropbox or Google Drive don't count against this limit.{" "}
              <Link to="/admin">Manage plan & storage in Settings →</Link>
            </p>
          </div>

          {data.files.length === 0 ? (
            <p className="cell-muted">No files uploaded yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Order</th>
                  <th>Size</th>
                  <th>Storage</th>
                  <th>Uploaded by</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.files.map((file) => (
                  <tr key={file.id}>
                    <td className="cell-primary">{file.fileName}</td>
                    <td className="cell-muted">
                      {file.order ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{file.order.customer?.name ?? file.order.description ?? "Order"}</span>
                          <OrderStatusBadge status={file.order.status} />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="cell-muted">{formatBytes(file.fileSize)}</td>
                    <td className="cell-muted">{PROVIDER_LABEL[file.storageProvider]}</td>
                    <td className="cell-muted">{file.uploadedBy?.name ?? "—"}</td>
                    <td className="cell-muted">{new Date(file.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpen(file)}
                        disabled={busyFileId === file.id}
                      >
                        {busyFileId === file.id ? "Opening…" : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
