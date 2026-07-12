import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import type { ProductionJob } from "../../types/index.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function JobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);

  useEffect(() => {
    apiFetch<ProductionJob[]>("/jobs", { token }).then(setJobs).catch(console.error);

    // Live updates so a status change at front desk (or another production
    // station) shows up here without polling.
    const socket = io(API_URL);
    socket.on("job:updated", (updated: ProductionJob) => {
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <div>
      <h1>Production Jobs</h1>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.status} {job.notes ? `— ${job.notes}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
