import type { ShopModels } from "../models/shopModels.js";
import { restockMaterialForItem } from "./materialConsumption.js";

export function calculateDiscountAmount(
  preDiscountTotal: number,
  discountType?: string | null,
  discountValue?: number | null
): number {
  if (!discountType || !discountValue || discountValue <= 0) return 0;
  const raw = discountType === "percent" ? preDiscountTotal * (discountValue / 100) : discountValue;
  // Clamped so a flat discount (or a >100% one, however unlikely) can never
  // push the total negative.
  return Math.min(Math.max(raw, 0), preDiscountTotal);
}

export async function recomputeOrderTotal(models: ShopModels, orderId: string): Promise<void> {
  const [items, order] = await Promise.all([
    models.OrderItem.find({ order: orderId }),
    models.Order.findById(orderId),
  ]);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const preDiscountTotal = itemsTotal + (order?.installRequired ? order.installCharge ?? 0 : 0);
  const discountAmount = calculateDiscountAmount(preDiscountTotal, order?.discountType, order?.discountValue);
  const total = preDiscountTotal - discountAmount;
  await models.Order.findByIdAndUpdate(orderId, { total });
}

// Sums the Payment ledger for an order and keeps amountPaid + the
// paymentStatus label in sync with it — the label stays manually
// overridable elsewhere (a comped job, a correction), but every time a
// real payment is recorded this is what makes it accurate again.
export async function recomputeOrderPayments(models: ShopModels, orderId: string): Promise<void> {
  const [payments, order] = await Promise.all([
    models.Payment.find({ order: orderId }),
    models.Order.findById(orderId),
  ]);
  if (!order) return;
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentStatus = amountPaid <= 0 ? "unpaid" : amountPaid >= order.total ? "paid" : "partial";
  await models.Order.findByIdAndUpdate(orderId, { amountPaid, paymentStatus });
}

// Returns whatever material stock an order's items consumed, and pulls
// every one of those items' production jobs out of the live queue — same
// as removing a single line item does ("nothing left to produce"), just for
// the whole order at once. Shared by the single-order PATCH and the bulk
// status-update route so cancelling from either place behaves identically;
// call this once, right after the order's status has actually been saved
// as "cancelled".
export async function cleanUpCancelledOrder(models: ShopModels, orderId: string): Promise<void> {
  const items = await models.OrderItem.find({ order: orderId });
  for (const item of items) {
    if (item.materialConsumedQty && item.materialConsumedQty > 0) {
      await restockMaterialForItem(models, item);
    }
  }
  await models.ProductionJob.deleteMany({ orderItem: { $in: items.map((i) => i._id) } });
}
