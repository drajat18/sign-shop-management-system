import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { usePlatformAuth } from "../../auth/PlatformAuthContext.js";
import type { Employee } from "../../types/index.js";

export default function ShopDetailModal({
  shopId,
  shopName,
  onClose,
}: {
  shopId: string;
  shopName: string;
  onClose: () => void;
}) {
  const { token, user } = usePlatformAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const canDeactivate = user?.role === "owner";

  function loadEmployees() {
    apiFetch<Employee[]>(`/platform/shops/${shopId}/users`, { token }).then(setEmployees).catch(console.error);
  }

  useEffect(loadEmployees, [shopId, token]);

  async function handleDeactivate(userId: string) {
    await apiFetch(`/platform/shops/${shopId}/users/${userId}/deactivate`, { method: "PATCH", token });
    loadEmployees();
  }

  async function handleReactivate(userId: string) {
    await apiFetch(`/platform/shops/${shopId}/users/${userId}/reactivate`, { method: "PATCH", token });
    loadEmployees();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{shopName}</h2>
            <p className="cell-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Employees — deactivating here works even for a shop's only admin, since it doesn't
              depend on that account still being able to act.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {employees === null ? (
          <p className="cell-muted">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {canDeactivate && <th></th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="cell-primary">{employee.name}</td>
                  <td className="cell-muted">{employee.email}</td>
                  <td className="cell-muted">{employee.role}</td>
                  <td>
                    <span className={`badge ${employee.active ? "badge-order-completed" : "badge-job-blocked"}`}>
                      {employee.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  {canDeactivate && (
                    <td>
                      {employee.active ? (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeactivate(employee.id)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleReactivate(employee.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
