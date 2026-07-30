import type { NextFunction, Request, Response } from "express";
import type { PlatformRole } from "../types/platformRoles.js";

export function requirePlatformRole(...allowed: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.platformAuth || !allowed.includes(req.platformAuth.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
