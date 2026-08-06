import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findProducts } from "@/lib/shopify";
import { feePct } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!query) {
    return NextResponse.json(
      { error: "Zoek op stylecode, SKU of productnaam" },
      { status: 400 }
    );
  }

  try {
    const matches = await findProducts(query);
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error: `Geen product gevonden voor "${query}". Controleer de stylecode, SKU of productnaam.`,
        },
        { status: 404 }
      );
    }
    const fee = feePct();
    return NextResponse.json({
      feePct: fee,
      products: matches.map((product) => (
        {
          productId: product.productId,
          productTitle: product.productTitle,
          imageUrl: product.imageUrl,
          sku: product.sku,
          variantCount: product.variants.length,
          variants: product.variants.map((v) => {
            const price = parseFloat(v.price);
            // max payout zodat je niet hoger kan gaan dan wat je aan payout kan krijgen
            // payout = price - (price * fee%) - 10
            const maxPayoutBeforeFee = Math.floor(price * (1 - fee / 100));
            const maxPayout = Math.round(maxPayoutBeforeFee - 10);
            return {
              id: v.id,
              size: v.size,
              currentPrice: price,
              maxPayout: Math.max(1, maxPayout), // ensure at least €1
            };
          }),
        }
      )),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Shopify fout: ${e.message}` },
      { status: 502 }
    );
  }
}

