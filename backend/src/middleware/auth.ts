import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getShopModels, type ShopModels } from "../models/shopModels.js";
import { getShopConnection } from "../services/shopConnection.js";
import type { Role } from "../types/roles.js";

export interface AuthPayload {
  userId: string;
  role: Role;
  shopId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      // Bound to the authenticated user's own shop database — every route
      // reads/writes through this instead of an imported singleton model,
      // which is what makes cross-shop data leakage structurally impossible
      // rather than something each route has to remember to prevent.
      models?: ShopModels;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.auth = payload;
    req.models = getShopModels(getShopConnection(payload.shopId));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
