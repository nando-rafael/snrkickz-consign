import { listingsTable } from "@/lib/db";
import { setVariantPrice } from "@/lib/shopify";

export async function recalcVariantPrice(variantId: string): Promise<void> {
  const actives = listingsTable.findActiveByVariantSortedBySalePrice(variantId);
  const anchor = listingsTable.findEarliestOriginalPrice(variantId);
  if (!anchor || anchor.original_price == null || !anchor.product_id) return;
  const original = anchor.original_price;

  // Collect all active override prices
  const overridePrices = actives
    .map((l) => l.sale_price_override)
    .filter((p): p is number => p != null);

  let target: number;
  if (overridePrices.length > 0) {
    // Lowest override wins (lowest-ask logic)
    target = Math.min(...overridePrices, original);
  } else {
    // No overrides — use the lowest calculated sale_price (existing logic)
    target = actives.length > 0 ? Math.min(actives[0].sale_price, original) : original;
  }

  await setVariantPrice(anchor.product_id, variantId, target);
}
