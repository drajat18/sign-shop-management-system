import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { JobStatusBadge } from "../../components/StatusBadge.js";
import OrderDetailModal from "../front-desk/OrderDetailModal.js";
import JobTicketModal from "./JobTicketModal.js";
import type { JobStatus, ProductionJob } from "../../types/index.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const JOB_STATUSES: JobStatus[] = ["queued", "in_progress", "blocked", "done"];

export default function JobsPage() {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[] | null>(null);
  const [assignable, setAssignable] = useState<{ id: string; name: string }[]>([]);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [ticketJob, setTicketJob] = useState<ProductionJob | null>(null);
  const canReassign = user?.role === "admin" || user?.role === "manager";

  function loadJobs() {
    apiFetch<ProductionJob[]>("/jobs", { token }).then(setJobs).catch(console.error);
  }

  useEffect(() => {
    loadJobs();
    if (canReassign) {
      apiFetch<{ id: string; name: string }[]>("/users/production", { token })
        .then(setAssignable)
        .catch(console.error);
    }

    // Live updates so a status change at another station (or a newly
    // placed order) shows up here without polling. The token is required —
    // the server uses it to put this connection in the right shop's room
    // so updates never cross tenant boundaries.
    const socket = io(API_URL, { auth: { token } });
    socket.on("job:updated", (updated: ProductionJob) => {
      setJobs((prev) => (prev ? prev.map((j) => (j.id === updated.id ? updated : j)) : prev));
    });
    socket.on("job:created", () => loadJobs());

    return () => {
      socket.disconnect();
    };
  }, [token, canReassign]);

  async function updateJob(id: string, patch: Partial<{ status: JobStatus; notes: string; assignedTo: string }>) {
    const updated = await apiFetch<ProductionJob>(`/jobs/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(patch),
    });
    setJobs((prev) => (prev ? prev.map((j) => (j.id === id ? updated : j)) : prev));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Production</h1>
          <p className="page-subtitle">
            {canReassign ? "All jobs, updated live as status changes." : "Jobs assigned to you, updated live."}
          </p>
        </div>
      </div>

      <div className="card">
        {jobs === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading jobs…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No jobs {canReassign ? "yet" : "assigned"}</p>
            <p className="empty-state-body">
              {canReassign
                ? "Jobs are created automatically when an order is placed."
                : "Jobs assigned to you will appear here in real time."}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sign</th>
                <th>Customer</th>
                <th>Due date</th>
                <th>Status</th>
                {canReassign && <th>Assigned to</th>}
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="cell-primary">
                    {job.orderItem.signType}
                    {job.orderItem.size ? ` — ${job.orderItem.size}` : ""}
                  </td>
                  <td className="cell-muted">{job.orderItem.order?.customer?.name ?? "—"}</td>
                  <td className="cell-muted">
                    {job.orderItem.order?.dueDate
                      ? new Date(job.orderItem.order.dueDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <JobStatusBadge status={job.status} />
                      <select
                        value={job.status}
                        onChange={(e) => updateJob(job.id, { status: e.target.value as JobStatus })}
                        style={{ fontSize: 12 }}
                      >
                        {JOB_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {canReassign && (
                    <td>
                      <select
                        value={job.assignedTo?.id ?? ""}
                        onChange={(e) => updateJob(job.id, { assignedTo: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {assignable.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="cell-muted">
                    <input
                      defaultValue={job.notes ?? ""}
                      placeholder="Add a note…"
                      onBlur={(e) => {
                        if (e.target.value !== (job.notes ?? "")) {
                          updateJob(job.id, { notes: e.target.value });
                        }
                      }}
                      style={{
                        border: "1px solid transparent",
                        background: "transparent",
                        fontSize: 13,
                        width: "100%",
                      }}
                      onFocus={(e) => (e.target.style.border = "1px solid var(--color-border)")}
                    />
                  </td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setOpenOrderId(job.orderItem.order.id)}
                    >
                      View order
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setTicketJob(job)}
                    >
                      Print ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openOrderId && (
        <OrderDetailModal
          orderId={openOrderId}
          editable={canReassign}
          onClose={() => setOpenOrderId(null)}
          onChanged={loadJobs}
        />
      )}

      {ticketJob && <JobTicketModal job={ticketJob} onClose={() => setTicketJob(null)} />}
    </div>
  );
}
