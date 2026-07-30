import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { PlatformRole } from "../types/platformRoles.js";

export interface PlatformAuthPayload {
  type: "platform";
  platformUserId: string;
  role: PlatformRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformAuth?: PlatformAuthPayload;
    }
  }
}

export function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as PlatformAuthPayload;
    if (payload.type !== "platform") {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.platformAuth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
