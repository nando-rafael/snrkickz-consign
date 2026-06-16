import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { adjustInventory, getVariantById } from "@/lib/shopify";
import { computeSalePrice } from "@/lib/config";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const variantId = String(body.variantId || "").trim();
  const styleCode = String(body.styleCode || "").trim().toUpperCase();
  const payout = parseFloat(body.payout);

  if (!variantId.startsWith("gid://shopify/ProductVariant/")) {
    return NextResponse.json({ error: "Ongeldige variant" }, { status: 400 });
  }
  if (!payout || payout <= 0) {
    return NextResponse.json({ error: "Vul een geldige payout in" }, { status: 400 });
  }

  try {
    const variant = await getVariantById(variantId);
    if (!variant) {
      return NextResponse.json({ error: "Variant niet gevonden in de store" }, { status: 404 });
    }

    const salePrice = computeSalePrice(payout);
    const currentPrice = parseFloat(variant.price);

    const existing = listingsTable.findEarliestOriginalPrice(variantId);
    const originalPrice = existing?.original_price ?? currentPrice;

    if (salePrice > originalPrice) {
      const fee = (salePrice - payout) / salePrice;
      const maxPayout = Math.floor(originalPrice * (1 - fee));
      return NextResponse.json(
        { error: `Payout te hoog. De storeprijs voor deze maat is €${originalPrice}. Maximale payout: €${maxPayout}.` },
        { status: 422 }
      );
    }

    await adjustInventory(variant.inventoryItemId, 1);

    const row = listingsTable.insert({
      consigner_id: session.id,
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
      status: "ACTIVE",
    });

    await recalcVariantPrice(variant.id);

    return NextResponse.json({ ok: true, id: row.id, sku: variant.sku, size: variant.size, salePrice });
  } catch (e: any) {
    return NextResponse.json({ error: `Er ging iets mis: ${e.message}` }, { status: 502 });
  }
}
