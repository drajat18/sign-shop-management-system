import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { JobStatusBadge } from "../../components/StatusBadge.js";
import type { JobStatus, ProductionJob } from "../../types/index.js";

const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "Start" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

// Landing page for a scanned job-ticket QR code — deliberately no sidebar,
// just one job and big tap targets, since this is used on a phone with
// hands that may be full of vinyl.
export default function ScanJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<ProductionJob>(`/jobs/${jobId}`, { token })
      .then((j) => {
        setJob(j);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load job"));
  }

  useEffect(load, [jobId, token]);

  async function setStatus(status: JobStatus) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<ProductionJob>(`/jobs/${jobId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setJob(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  if (error && !job) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Can't load this job</h1>
          <p className="cell-muted" style={{ fontSize: 14, marginBottom: 16 }}>
            {error}
          </p>
          <button type="button" className="btn btn-outline btn-block" onClick={() => navigate("/jobs")}>
            Back to Production
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="auth-page">
        <p className="cell-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Sign Shop</span>
        </div>
        <h1 className="auth-title">{job.orderItem.signType}</h1>
        <p className="auth-subtitle">
          {[job.orderItem.size, job.orderItem.material].filter(Boolean).join(" · ") || "—"} · Qty{" "}
          {job.orderItem.quantity}
        </p>

        <p className="cell-muted" style={{ fontSize: 14, marginBottom: 4 }}>
          {job.orderItem.order?.customer?.name ?? "—"}
        </p>
        <div style={{ marginBottom: 20 }}>
          <JobStatusBadge status={job.status} />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {JOB_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={s.value === job.status ? "btn btn-primary" : "btn btn-outline"}
              style={{ padding: "16px", fontSize: 16 }}
              disabled={busy || s.value === job.status}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-outline btn-block"
          style={{ marginTop: 20 }}
          onClick={() => navigate("/jobs")}
        >
          Back to Production
        </button>
      </div>
    </div>
  );
}
