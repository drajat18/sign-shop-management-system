import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../../api/client.js";
import { usePlatformAuth } from "../../auth/PlatformAuthContext.js";
import type { PlatformRole, PlatformTeamMember } from "../../types/index.js";

const ROLE_OPTIONS: PlatformRole[] = ["owner", "support", "billing", "onboarding"];
const ROLE_LABEL: Record<PlatformRole, string> = {
  owner: "Owner",
  support: "Support",
  billing: "Billing",
  onboarding: "Onboarding",
};
const ROLE_DESCRIPTION: Record<PlatformRole, string> = {
  owner: "Full access: manage the team, all shops, billing oversight, impersonation, system config.",
  support: "Can view shops and impersonate for support. Cannot manage billing or the team.",
  billing: "Manages subscriptions and plan changes. Cannot see a shop's operational data.",
  onboarding: "Provisions new shops. No ongoing support-level access.",
};

export default function TeamPage() {
  const { token } = usePlatformAuth();
  const [team, setTeam] = useState<PlatformTeamMember[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PlatformRole>("support");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadTeam() {
    apiFetch<PlatformTeamMember[]>("/platform/team", { token }).then(setTeam).catch(console.error);
  }

  useEffect(loadTeam, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/platform/team", {
        method: "POST",
        token,
        body: JSON.stringify({ name, email, password, role }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("support");
      setShowForm(false);
      loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add team member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    await apiFetch(`/platform/team/${id}/deactivate`, { method: "PATCH", token });
    loadTeam();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Internal platform team — separate from any shop's employees.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add team member"}
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
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                <select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}>
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
              {submitting ? "Creating…" : "Add team member"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {team === null ? (
          <div className="empty-state">
            <p className="empty-state-body">Loading team…</p>
          </div>
        ) : (
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
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="cell-primary">{member.name}</td>
                  <td className="cell-muted">{member.email}</td>
                  <td className="cell-muted">{ROLE_LABEL[member.role]}</td>
                  <td>
                    <span className={`badge ${member.active ? "badge-order-completed" : "badge-job-blocked"}`}>
                      {member.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td>
                    {member.active && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDeactivate(member.id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
