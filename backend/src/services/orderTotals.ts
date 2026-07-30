import type { ShopModels } from "../models/shopModels.js";

export async function recomputeOrderTotal(models: ShopModels, orderId: string): Promise<void> {
  const items = await models.OrderItem.find({ order: orderId });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await models.Order.findByIdAndUpdate(orderId, { total });
}
