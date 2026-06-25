import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { recalcVariantPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PriceMode = "fixed" | "add" | "subtract" | "addPercent" | "subtractPercent";

function calcNewPrice(currentPrice: number, mode: PriceMode, value: number): number {
  switch (mode) {
    case "fixed":
      return value;
    case "add":
      return currentPrice + value;
    case "subtract":
      return Math.max(0.01, currentPrice - value);
    case "addPercent":
      return currentPrice * (1 + value / 100);
    case "subtractPercent":
      return Math.max(0.01, currentPrice * (1 - value / 100));
    default:
      return currentPrice;
  }
}

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

  const { listingIds, priceMode, value } = body as {
    listingIds?: unknown;
    priceMode?: unknown;
    value?: unknown;
  };

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

  const validModes: PriceMode[] = ["fixed", "add", "subtract", "addPercent", "subtractPercent"];
  if (typeof priceMode !== "string" || !validModes.includes(priceMode as PriceMode)) {
    return NextResponse.json(
      { error: "Ongeldig priceMode. Kies uit: fixed, add, subtract, addPercent, subtractPercent" },
      { status: 400 }
    );
  }

  if (typeof value !== "number" || value <= 0) {
    return NextResponse.json(
      { error: "value moet een positief getal zijn" },
      { status: 400 }
    );
  }

  const admin = isAdmin(session.email);
  const affectedVariantIds = new Set<string>();
  let updated = 0;
  const errors: string[] = [];
  const previews: Array<{ id: number; oldPrice: number; newPrice: number; title: string | null; size: string }> = [];

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

    const currentPrice = listing.sale_price_override ?? listing.sale_price;
    const newPrice = Math.round(calcNewPrice(currentPrice, priceMode as PriceMode, value) * 100) / 100;

    if (newPrice <= 0) {
      errors.push(`Listing #${id}: berekende prijs is ongeldig (${newPrice})`);
      continue;
    }

    const result = listingsTable.update(id, { sale_price_override: newPrice });
    if (!result) {
      errors.push(`Listing #${id}: update mislukt`);
      continue;
    }

    if (listing.variant_id) {
      affectedVariantIds.add(listing.variant_id);
    }

    previews.push({
      id: listing.id,
      oldPrice: currentPrice,
      newPrice,
      title: listing.product_title,
      size: listing.size,
    });

    updated++;
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
    updated,
    previews,
    errors: errors.length > 0 ? errors : undefined,
  });
}
