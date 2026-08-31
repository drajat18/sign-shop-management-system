import type { ShopModels } from "../models/shopModels.js";

export async function recomputeOrderTotal(models: ShopModels, orderId: string): Promise<void> {
  const [items, order] = await Promise.all([
    models.OrderItem.find({ order: orderId }),
    models.Order.findById(orderId),
  ]);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = itemsTotal + (order?.installRequired ? order.installCharge ?? 0 : 0);
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
