import type { Role } from "../types/index.js";

// Central place for "who can see what" so the sidebar nav and route
// guards can't drift apart from each other.
export const PAGE_ACCESS = {
  orders: ["admin", "manager", "front_desk"] as Role[],
  jobs: ["admin", "manager", "production"] as Role[],
  employees: ["admin"] as Role[],
  settings: ["admin"] as Role[],
  reports: ["admin"] as Role[],
  files: ["admin", "manager", "front_desk", "production"] as Role[],
};

export const ROLE_LANDING_PAGE: Record<Role, string> = {
  admin: "/orders",
  manager: "/orders",
  front_desk: "/orders",
  production: "/jobs",
};

export const NAV_ITEMS: { to: string; label: string; roles: Role[] }[] = [
  { to: "/orders", label: "Orders", roles: PAGE_ACCESS.orders },
  { to: "/jobs", label: "Production", roles: PAGE_ACCESS.jobs },
  { to: "/files", label: "Files", roles: PAGE_ACCESS.files },
  { to: "/employees", label: "Employees", roles: PAGE_ACCESS.employees },
  { to: "/reports", label: "Reports", roles: PAGE_ACCESS.reports },
  { to: "/admin", label: "Settings", roles: PAGE_ACCESS.settings },
];

export function canAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  front_desk: "Front Desk",
  production: "Production",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Full access: employees, pricing, reports, integrations settings.",
  manager: "Front desk + production visibility, can reassign jobs. Cannot manage employees/billing.",
  front_desk: "Create/edit orders, take payments, view schedule.",
  production: "View assigned jobs, update job status, log materials. Cannot edit pricing/customer info.",
};
