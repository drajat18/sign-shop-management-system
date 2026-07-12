export const ROLES = ["admin", "manager", "front_desk", "production"] as const;

export type Role = (typeof ROLES)[number];
