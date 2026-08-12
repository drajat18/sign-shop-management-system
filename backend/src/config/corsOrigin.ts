// CORS_ORIGIN covers the stable production domain (comma-separate for more
// than one). Vercel additionally gives every deploy — preview, or a branch
// alias like -git-main-<team> — its own unique subdomain, so this project's
// own *.vercel.app deployments are allowed on top of that instead of needing
// a Render env var update every time a new deploy URL shows up. Shared
// between the REST API's cors() middleware and the Socket.IO server so a
// branch/preview origin isn't allowed for API calls but rejected for
// sockets.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const VERCEL_PREVIEW_PATTERN = /^https:\/\/sign-shop-management-system(-[a-z0-9-]+)?\.vercel\.app$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin);
}
