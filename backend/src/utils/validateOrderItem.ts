// Shared by order creation, adding an item to an existing order, and
// editing an item — the same three fields (signType, price, quantity) get
// validated in all three places, and they need to agree: a negative price
// or quantity should never be possible from any of them, not just the one
// the frontend happens to walk through.
export function validateOrderItemFields(item: {
  signType?: string;
  price?: number;
  quantity?: number;
}): string | null {
  if (!item.signType?.trim()) {
    return "Each item needs a sign type";
  }
  if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0) {
    return "Each item needs a price greater than 0";
  }
  if (
    item.quantity !== undefined &&
    (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0)
  ) {
    return "Quantity must be a whole number greater than 0";
  }
  return null;
}
