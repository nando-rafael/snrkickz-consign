import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { adjustInventory, addProductToCollection, getVariantById } from "@/lib/shopify";
import { computeSalePrice } from "@/lib/config";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Process a single listing: validate, adjust inventory, insert N rows, recalc price. */
async function processSingleListing(
  consignerId: number,
  variantId: string,
  styleCode: string,
  payout: number,
  quantity = 1
): Promise<{ ok: true; ids: number[]; sku: string; size: string; salePrice: number }> {
  if (!variantId.startsWith("gid://shopify/ProductVariant/")) {
    throw Object.assign(new Error("Ongeldige variant"), { status: 400 });
  }
  if (!payout || payout <= 0) {
    throw Object.assign(new Error("Vul een geldige payout in"), { status: 400 });
  }
  const qty = Math.max(1, Math.min(10, Math.round(quantity)));

  const variant = await getVariantById(variantId);
  if (!variant) {
    throw Object.assign(new Error("Variant niet gevonden in de store"), { status: 404 });
  }

  const salePrice = computeSalePrice(payout);
  const currentPrice = parseFloat(variant.price);
  const existing = listingsTable.findEarliestOriginalPrice(variantId);
  const originalPrice = existing?.original_price ?? currentPrice;

  if (salePrice > originalPrice) {
    const fee = (salePrice - payout) / salePrice;
    const maxPayout = Math.floor(originalPrice * (1 - fee));
    throw Object.assign(
      new Error(
        `Payout te hoog. De storeprijs voor maat ${variant.size} is €${originalPrice}. Maximale payout: €${maxPayout}.`
      ),
      { status: 422 }
    );
  }

  // Adjust Shopify inventory once for the total quantity
  await adjustInventory(variant.inventoryItemId, qty);

  // Create one listing row per unit
  const ids: number[] = [];
  for (let i = 0; i < qty; i++) {
    const row = listingsTable.insert({
      consigner_id: consignerId,
      sku: variant.sku,
      style_code: styleCode || variant.sku,
      size: variant.size,
      product_title: variant.productTitle,
      product_image: variant.imageUrl,
      product_id: variant.productId,
      variant_id: variant.id,
      inventory_item_id: variant.inventoryItemId,
      payout,
      sale_price: salePrice,
      original_price: originalPrice,
      quantity: 1,
      status: "ACTIVE",
    });
    ids.push(row.id);
  }

  await recalcVariantPrice(variant.id);

  try {
    const collectionId = process.env.CONSIGN_COLLECTION_ID;
    if (collectionId) {
      await addProductToCollection(variant.productId, collectionId);
    }
  } catch (e: any) {
    console.error(`Failed to add product to collection: ${e.message}`);
    // Don't throw — listings are already created
  }

  return { ok: true, ids, sku: variant.sku, size: variant.size, salePrice };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const styleCode = String(body.styleCode || "").trim().toUpperCase();

  // ── Batch mode: { styleCode, listings: [{ variantId, payout, quantity? }, ...] } ──
  if (Array.isArray(body.listings)) {
    const items: { variantId: string; payout: number; quantity?: number }[] = body.listings;

    if (items.length === 0) {
      return NextResponse.json({ error: "Geen listings opgegeven" }, { status: 400 });
    }

    const created: { ids: number[]; sku: string; size: string; salePrice: number }[] = [];
    const failed: { variantId: string; error: string }[] = [];

    for (const item of items) {
      const variantId = String(item.variantId || "").trim();
      const payout = parseFloat(String(item.payout));
      const quantity = item.quantity ?? 1;
      try {
        const result = await processSingleListing(session.id, variantId, styleCode, payout, quantity);
        created.push({ ids: result.ids, sku: result.sku, size: result.size, salePrice: result.salePrice });
      } catch (e: any) {
        failed.push({ variantId, error: e.message });
      }
    }

    return NextResponse.json({ ok: true, created, failed });
  }

  // ── Single mode (backward compatible): { variantId, styleCode, payout, quantity? } ──
  const variantId = String(body.variantId || "").trim();
  const payout = parseFloat(body.payout);
  const quantity = body.quantity ?? 1;

  try {
    const result = await processSingleListing(session.id, variantId, styleCode, payout, quantity);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.status ?? 502;
    return NextResponse.json({ error: e.message ?? `Er ging iets mis: ${e.message}` }, { status });
  }
}
