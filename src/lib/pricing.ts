import { listingsTable } from "@/lib/db";
import { setVariantPrice } from "@/lib/shopify";

export async function recalcVariantPrice(variantId: string): Promise<void> {
  const actives = listingsTable.findActiveByVariantSortedBySalePrice(variantId);
  const anchor = listingsTable.findEarliestOriginalPrice(variantId);
  if (!anchor || anchor.original_price == null || !anchor.product_id) return;
  const original = anchor.original_price;
  const target = actives.length > 0 ? Math.min(actives[0].sale_price, original) : original;
  await setVariantPrice(anchor.product_id, variantId, target);
}
