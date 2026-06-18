import { NextRequest, NextResponse } from "next/server";
import { inventoryTable, listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { findProductBySku, adjustInventory, addProductToCollection } from "@/lib/shopify";
import { computeSalePrice } from "@/lib/config";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  const item = inventoryTable.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item niet gevonden" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const payout = parseFloat(body.payout);
  const sale_price_override = body.sale_price ? parseFloat(body.sale_price) : null;

  if (!payout || payout <= 0) {
    return NextResponse.json({ error: "Vul een geldige payout in" }, { status: 400 });
  }

  const salePrice = sale_price_override && sale_price_override > 0
    ? sale_price_override
    : computeSalePrice(payout);

  try {
    // Look up the product/variant in Shopify by SKU and match on size
    const product = await findProductBySku(item.sku);
    if (!product) {
      return NextResponse.json(
        { error: `Geen Shopify-product gevonden voor SKU "${item.sku}"` },
        { status: 404 }
      );
    }

    const variant = product.variants.find(
      (v) => v.size.toLowerCase() === item.size.toLowerCase()
    );
    if (!variant) {
      return NextResponse.json(
        {
          error: `Maat "${item.size}" niet gevonden voor SKU "${item.sku}". Beschikbare maten: ${product.variants.map((v) => v.size).join(", ")}`,
        },
        { status: 404 }
      );
    }

    const existing = listingsTable.findEarliestOriginalPrice(variant.id);
    const originalPrice = existing?.original_price ?? parseFloat(variant.price);

    await adjustInventory(variant.inventoryItemId, 1);

    const listing = listingsTable.insert({
      consigner_id: session.id,
      sku: item.sku,
      style_code: item.sku,
      size: item.size,
      product_title: item.product_title || product.productTitle,
      product_image: product.imageUrl,
      product_id: product.productId,
      variant_id: variant.id,
      inventory_item_id: variant.inventoryItemId,
      payout,
      sale_price: salePrice,
      original_price: originalPrice,
      status: "ACTIVE",
    });

    await recalcVariantPrice(variant.id);

    try {
      const collectionId = process.env.CONSIGN_COLLECTION_ID;
      if (collectionId) {
        await addProductToCollection(product.productId, collectionId);
      }
    } catch (e: any) {
      console.error(`Failed to add product to collection: ${e.message}`);
      // Don't throw — listing is already created
    }

    // Remove from inventory (or decrement quantity if > 1)
    if (item.quantity > 1) {
      inventoryTable.updateQuantity(id, item.quantity - 1);
    } else {
      inventoryTable.delete(id);
    }

    return NextResponse.json({
      ok: true,
      listing_id: listing.id,
      sku: item.sku,
      size: item.size,
      salePrice,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Conversie mislukt: ${e.message}` },
      { status: 502 }
    );
  }
}
