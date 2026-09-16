import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "../../auth/roles.js";
import type { Employee, Role } from "../../types/index.js";

const ROLE_OPTIONS: Role[] = ["admin", "manager", "front_desk", "production"];

export default function EmployeesPage() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("front_desk");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadEmployees() {
    apiFetch<Employee[]>("/users", { token }).then(setEmployees).catch(console.error);
  }

  useEffect(loadEmployees, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/users", {
        method: "POST",
        token,
        body: JSON.stringify({ name, email, password, role }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("front_desk");
      setShowForm(false);
      loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    await apiFetch(`/users/${id}/deactivate`, { method: "PATCH", token });
    loadEmployees();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Every login is created here — there's no public signup.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add employee"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label className="field">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Temporary password
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label className="field">
                Role
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="cell-muted" style={{ margin: "12px 0 16px", fontSize: 13 }}>
              {ROLE_DESCRIPTION[role]}
            </p>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create employee"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {employees === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading employees…</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="cell-primary">{employee.name}</td>
                  <td className="cell-muted">{employee.email}</td>
                  <td className="cell-muted">{ROLE_LABEL[employee.role]}</td>
                  <td>
                    <span className={`badge ${employee.active ? "badge-order-completed" : "badge-job-blocked"}`}>
                      {employee.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td>
                    {employee.active && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDeactivate(employee.id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>What each role can access</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ROLE_OPTIONS.map((r) => (
            <div key={r} style={{ display: "flex", gap: 12 }}>
              <span className="badge badge-order-design_approval" style={{ minWidth: 90, justifyContent: "center" }}>
                {ROLE_LABEL[r]}
              </span>
              <span className="cell-muted" style={{ fontSize: 13 }}>
                {ROLE_DESCRIPTION[r]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
