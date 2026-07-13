import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";

export async function recomputeOrderTotal(orderId: string): Promise<void> {
  const items = await OrderItem.find({ order: orderId });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await Order.findByIdAndUpdate(orderId, { total });
}
