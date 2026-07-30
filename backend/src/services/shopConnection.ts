import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";

// One Atlas cluster, one database per shop — opened lazily and cached so
// a shop's connection is reused across requests instead of reconnecting
// every time. At 50-100 shops this is a trivial number of open
// connections; would need an LRU eviction policy well before that stops
// being true.
const connections = new Map<string, mongoose.Connection>();

export function getShopConnection(shopId: string): mongoose.Connection {
  const existing = connections.get(shopId);
  if (existing) return existing;

  const connection = mongoose.createConnection(getMongoUri(process.env.MONGODB_URI), {
    dbName: `shop_${shopId}`,
  });
  connections.set(shopId, connection);
  return connection;
}
