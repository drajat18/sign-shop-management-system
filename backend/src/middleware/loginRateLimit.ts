import type { NextFunction, Request, Response } from "express";

// In-memory per-process counter, same pattern as shopConnection.ts's
// connection cache — good enough for a single Express process, would need
// a shared store (Redis) behind a load balancer.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

interface Attempts {
  count: number;
  windowStart: number;
}

const attemptsByKey = new Map<string, Attempts>();

function keyFor(req: Request): string {
  const email = ((req.body as { email?: string })?.email ?? "").trim().toLowerCase();
  return `${req.ip}:${email}`;
}

// Applied to a login route ahead of the credential check, so repeated
// guesses (right IP+email, wrong password) get throttled regardless of
// which login path (shop or platform) is being hit.
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = keyFor(req);
  const now = Date.now();
  const entry = attemptsByKey.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attemptsByKey.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
    res.status(429).json({
      error: `Too many login attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`,
    });
    return;
  }

  entry.count += 1;
  next();
}

// Called after a successful login so a legitimate user who mistyped their
// password a few times isn't left throttled for the rest of the window.
export function clearLoginAttempts(req: Request): void {
  attemptsByKey.delete(keyFor(req));
}
