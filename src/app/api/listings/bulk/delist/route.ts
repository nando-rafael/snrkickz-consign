import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { adjustInventory } from "@/lib/shopify";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const { listingIds } = body as { listingIds?: unknown };
  if (
    !Array.isArray(listingIds) ||
    listingIds.length === 0 ||
    !listingIds.every((id) => typeof id === "number")
  ) {
    return NextResponse.json(
      { error: "listingIds moet een niet-lege array van nummers zijn" },
      { status: 400 }
    );
  }

  const admin = isAdmin(session.email);
  const affectedVariantIds = new Set<string>();
  let delistedCount = 0;
  const errors: string[] = [];

  for (const id of listingIds as number[]) {
    const listing = listingsTable.findById(id);

    if (!listing) {
      errors.push(`Listing #${id} niet gevonden`);
      continue;
    }

    if (!admin && listing.consigner_id !== session.id) {
      errors.push(`Listing #${id}: geen toegang`);
      continue;
    }

    if (listing.status !== "ACTIVE") {
      errors.push(`Listing #${id} is niet actief (status: ${listing.status})`);
      continue;
    }

    try {
      if (listing.inventory_item_id) {
        await adjustInventory(listing.inventory_item_id, -1);
      }
      listingsTable.markDelisted(listing.id);
      if (listing.variant_id) {
        affectedVariantIds.add(listing.variant_id);
      }
      delistedCount++;
    } catch (e: any) {
      errors.push(`Listing #${id}: ${e.message}`);
    }
  }

  // Recalculate prices for all affected variants
  for (const variantId of affectedVariantIds) {
    try {
      await recalcVariantPrice(variantId);
    } catch (e: any) {
      errors.push(`Variant ${variantId} prijsherberekening mislukt: ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    delistedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
