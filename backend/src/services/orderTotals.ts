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
