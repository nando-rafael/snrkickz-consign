import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findProduct } from "@/lib/shopify";
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
    const product = await findProduct(query);
    if (!product) {
      return NextResponse.json(
        {
          error: `Geen product gevonden voor "${query}". Controleer de stylecode, SKU of productnaam.`,
        },
        { status: 404 }
      );
    }
    const fee = feePct();
    return NextResponse.json({
      productTitle: product.productTitle,
      imageUrl: product.imageUrl,
      sku: product.sku,
      feePct: fee,
      variants: product.variants.map((v) => ({
        id: v.id,
        size: v.size,
        currentPrice: parseFloat(v.price),
        // max payout zodat verkoopprijs nooit boven de storeprijs uitkomt
        maxPayout: Math.floor(parseFloat(v.price) * (1 - fee / 100)),
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Shopify fout: ${e.message}` },
      { status: 502 }
    );
  }
}
