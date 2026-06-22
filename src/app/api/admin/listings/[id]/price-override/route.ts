import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
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

  const listing = listingsTable.findById(Number(params.id));
  if (!listing) {
    return NextResponse.json({ error: "Listing niet gevonden" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const { price } = body as { price?: unknown };
  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json(
      { error: "Prijs moet een positief getal zijn" },
      { status: 400 }
    );
  }

  const updated = listingsTable.update(listing.id, { sale_price_override: price });
  if (!updated) {
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }

  if (listing.variant_id) {
    try {
      await recalcVariantPrice(listing.variant_id);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Shopify update mislukt: ${e.message}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ listing: updated });
}
