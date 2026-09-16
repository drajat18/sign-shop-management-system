import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getShopModels, type ShopModels } from "../models/shopModels.js";
import { getShopConnection } from "../services/shopConnection.js";
import type { Role } from "../types/roles.js";

export interface AuthPayload {
  type: "shop";
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  // Platform-team tokens are signed with the same secret, so the `type`
  // marker is what keeps the two token kinds from ever being interchangeable.
  if (payload.type !== "shop") {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const models = getShopModels(getShopConnection(payload.shopId));
  // A JWT is only proof of who logged in, not that they still should be
  // able to — without this, deactivating an employee (see users.routes.ts)
  // doesn't actually revoke anything until their token happens to expire on
  // its own, up to 12h later. Re-checking against the live User record on
  // every request is what makes "deactivate" instant instead of eventual,
  // and also picks up a role change (promotion/demotion) immediately rather
  // than leaving a stale role baked into an already-issued token.
  const user = await models.User.findById(payload.userId).select("active role");
  if (!user || !user.active) {
    res.status(401).json({ error: "This account has been deactivated." });
    return;
  }

  req.auth = { ...payload, role: user.role };
  req.models = models;
  next();
}
