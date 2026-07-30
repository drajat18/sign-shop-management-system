import type { Connection } from "mongoose";

export interface Migration {
  id: string;
  description: string;
  up: (connection: Connection) => Promise<void>;
}

// Ordered list — new migrations always append to the end, never edit or
// reorder a migration that's already shipped, since some shops may have
// already applied it and others haven't.
export const migrations: Migration[] = [
  {
    id: "001-baseline",
    description:
      "Baseline — marks a shop database as initialized under the multi-tenant model. Real schema changes start from 002.",
    up: async () => {
      // No-op: this migration's only purpose is to exist, so every shop
      // (new or pre-existing) has a starting point in the applied-migrations
      // ledger for future migrations to build on.
    },
  },
];
