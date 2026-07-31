import type { NextFunction, Request, Response } from "express";
import { getShopModels, type ShopModels } from "../models/shopModels.js";
import { getShopConnection } from "../services/shopConnection.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set from the :shopId path segment on public portal routes — there's
      // no login here, so unlike req.models (auth.ts) this isn't backed by
      // a verified token, only by which order a customer's link points to.
      portalModels?: ShopModels;
    }
  }
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function resolvePortalShop(req: Request, res: Response, next: NextFunction) {
  const { shopId } = req.params;
  if (!shopId || !OBJECT_ID_RE.test(shopId)) {
    return res.status(400).json({ error: "Invalid link" });
  }
  req.portalModels = getShopModels(getShopConnection(shopId));
  next();
}
