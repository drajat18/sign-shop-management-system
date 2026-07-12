import type { Role } from "../types/index.js";

// Central place for "who can see what" so pages don't hardcode role checks.
export const ROLE_LANDING_PAGE: Record<Role, string> = {
  admin: "/admin",
  manager: "/orders",
  front_desk: "/orders",
  production: "/jobs",
};

export function canAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
