import { Schema, type Connection } from "mongoose";
import { migrations } from "../migrations/index.js";
import Shop from "../models/platform/Shop.js";
import { getShopConnection } from "./shopConnection.js";

const migrationRecordSchema = new Schema({
  migrationId: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now },
});

function getMigrationModel(connection: Connection) {
  return connection.models.MigrationRecord ?? connection.model("MigrationRecord", migrationRecordSchema, "_migrations");
}

// Applies whatever migrations a single shop hasn't seen yet, in order,
// recording each as it succeeds — if migration 3 of 5 throws, 1 and 2
// stay applied and re-running later resumes at 3, it doesn't redo 1-2.
export async function runMigrationsForShop(connection: Connection): Promise<string[]> {
  const MigrationRecord = getMigrationModel(connection);
  const appliedDocs = await MigrationRecord.find().select("migrationId");
  const applied = new Set(appliedDocs.map((doc) => doc.migrationId as string));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await migration.up(connection);
    await MigrationRecord.create({ migrationId: migration.id });
    newlyApplied.push(migration.id);
  }

  return newlyApplied;
}

// Run as a deploy step after shipping a schema change, so every shop's
// database stays compatible with the one shared codebase. Safe to run
// repeatedly — shops with nothing pending are a no-op.
export async function runMigrationsForAllShops(): Promise<void> {
  const shops = await Shop.find({ active: true });
  for (const shop of shops) {
    const connection = getShopConnection(shop.id);
    const applied = await runMigrationsForShop(connection);
    if (applied.length > 0) {
      console.log(`Shop ${shop.name} (${shop.id}): applied ${applied.join(", ")}`);
    }
  }
}
