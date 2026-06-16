import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/url";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { adjustInventory } from "@/lib/shopify";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(redirectTo(req, "/login"), 303);

  const listing = listingsTable.findById(Number(params.id));
  const admin = isAdmin(session.email);
  if (!listing || (!admin && listing.consigner_id !== session.id)) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
  if (listing.status !== "ACTIVE") {
    return NextResponse.redirect(redirectTo(req, admin ? "/admin" : "/dashboard"), 303);
  }

  try {
    if (listing.inventory_item_id) await adjustInventory(listing.inventory_item_id, -1);
    listingsTable.markDelisted(listing.id);
    if (listing.variant_id) await recalcVariantPrice(listing.variant_id);
  } catch (e: any) {
    return NextResponse.json({ error: `Delisten mislukt: ${e.message}` }, { status: 502 });
  }
  return NextResponse.redirect(redirectTo(req, admin ? "/admin" : "/dashboard"), 303);
}
