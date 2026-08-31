import type { Connection } from "mongoose";
import { getShopModels } from "../models/shopModels.js";

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
  {
    id: "002-backfill-paid-order-amounts",
    description:
      "Backfills the Payment ledger for orders already marked paid before the ledger existed, so amountPaid (and anything built on it — reports, the accounting CSV) isn't $0 on orders a shop already collected in full. Partial-payment orders are left alone: there's no reliable record of how much was actually collected historically, so nothing is guessed.",
    up: async (connection: Connection) => {
      const { Order, Payment } = getShopModels(connection);
      const unbackfilled = await Order.find({ paymentStatus: "paid", amountPaid: { $in: [0, null, undefined] } });
      for (const order of unbackfilled) {
        if (order.total <= 0) continue;
        await Payment.create({
          order: order._id,
          amount: order.total,
          method: "other",
          note: "migration:002-backfill",
        });
        order.amountPaid = order.total;
        await order.save();
      }
    },
  },
];
