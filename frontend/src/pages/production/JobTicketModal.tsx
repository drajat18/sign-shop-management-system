import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ProductionJob } from "../../types/index.js";

export default function JobTicketModal({
  job,
  onClose,
}: {
  job: ProductionJob;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const scanUrl = `${window.location.origin}/scan/job/${job.id}`;
    QRCode.toDataURL(scanUrl, { width: 220, margin: 1 }).then(setQrDataUrl);
  }, [job.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header no-print">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Job ticket</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div id="job-ticket-print">
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{job.orderItem.signType}</h2>
          <p className="cell-muted" style={{ marginTop: 4 }}>
            {[job.orderItem.size, job.orderItem.material].filter(Boolean).join(" · ") || "—"} · Qty{" "}
            {job.orderItem.quantity}
          </p>
          <div style={{ marginTop: 16, fontSize: 14 }}>
            <p>
              <strong>Customer:</strong> {job.orderItem.order?.customer?.name ?? "—"}
            </p>
            <p style={{ marginTop: 4 }}>
              <strong>Due:</strong>{" "}
              {job.orderItem.order?.dueDate
                ? new Date(job.orderItem.order.dueDate).toLocaleDateString()
                : "—"}
            </p>
          </div>
          {qrDataUrl && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <img src={qrDataUrl} alt="Scan to update job status" width={180} height={180} />
              <p className="cell-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Scan to update status
              </p>
            </div>
          )}
        </div>

        <div className="modal-actions no-print">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
