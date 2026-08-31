import type { ShopModels } from "../models/shopModels.js";

interface ConsumableItem {
  materialStock?: unknown;
  widthIn?: number | null;
  heightIn?: number | null;
  quantity: number;
}

// How much of a tracked material one line item uses: area-based stock
// (sold/stocked by the sheet or roll) consumes width×height in square feet
// per unit; everything else consumes one unit of stock per item quantity.
// Falls back to quantity alone when dimensions are missing even for an
// area-based material — better to log *something* than silently skip
// consumption because a size wasn't entered.
async function computeConsumedQty(models: ShopModels, item: ConsumableItem): Promise<number> {
  if (!item.materialStock) return 0;
  const stock = await models.MaterialStock.findById(item.materialStock as string);
  if (!stock) return 0;
  if (stock.isAreaBased && item.widthIn && item.heightIn) {
    const sqftPerUnit = (item.widthIn * item.heightIn) / 144;
    return Math.round(sqftPerUnit * item.quantity * 100) / 100;
  }
  return item.quantity;
}

// Deducts stock for a newly-committed line item (never called for a quote —
// see orders.routes.ts) and returns how much was actually deducted, for the
// caller to store on the item as materialConsumedQty so a later restock
// reverses exactly this amount.
export async function consumeMaterialForItem(models: ShopModels, item: ConsumableItem): Promise<number> {
  if (!item.materialStock) return 0;
  const consumedQty = await computeConsumedQty(models, item);
  if (consumedQty > 0) {
    await models.MaterialStock.findByIdAndUpdate(item.materialStock as string, {
      $inc: { quantityOnHand: -consumedQty },
    });
  }
  return consumedQty;
}

// Reverses a previously recorded consumption — used when an item is
// deleted, an order is cancelled, or an item's material/quantity/dimensions
// are edited (restock the old amount, then consume the new amount).
export async function restockMaterialForItem(
  models: ShopModels,
  item: { materialStock?: unknown; materialConsumedQty?: number | null }
): Promise<void> {
  if (!item.materialStock || !item.materialConsumedQty) return;
  await models.MaterialStock.findByIdAndUpdate(item.materialStock as string, {
    $inc: { quantityOnHand: item.materialConsumedQty },
  });
}
