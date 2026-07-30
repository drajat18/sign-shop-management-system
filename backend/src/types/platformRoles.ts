export const PLATFORM_ROLES = ["owner", "support", "billing", "onboarding"] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
