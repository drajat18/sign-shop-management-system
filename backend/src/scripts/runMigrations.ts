import "dotenv/config";
import mongoose from "mongoose";
import { getMongoUri } from "../config/db.js";
import { runMigrationsForAllShops } from "../services/migrationRunner.js";

async function main() {
  await mongoose.connect(getMongoUri(process.env.MONGODB_URI), { dbName: "platform" });
  await runMigrationsForAllShops();
  console.log("Migrations complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration run failed:", err);
  process.exit(1);
});
