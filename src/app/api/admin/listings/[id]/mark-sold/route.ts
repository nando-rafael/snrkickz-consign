import { NextRequest, NextResponse } from "next/server";
import { listingsTable, payoutsTable, consignersTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { recalcVariantPrice } from "@/lib/pricing";
import { sendDiscordNotification } from "@/lib/discord";

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

  if (listing.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Alleen actieve listings kunnen als verkocht worden gemarkeerd" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const { orderName } = body as { orderName?: unknown };
  if (typeof orderName !== "string" || !orderName.trim()) {
    return NextResponse.json(
      { error: "Ordernaam mag niet leeg zijn" },
      { status: 400 }
    );
  }

  const trimmedOrderName = orderName.trim();

  listingsTable.markSold(listing.id, trimmedOrderName);

  payoutsTable.insert({
    consigner_id: listing.consigner_id,
    listing_id: listing.id,
    amount: listing.payout,
    order_name: trimmedOrderName,
  });

  if (listing.variant_id) {
    try {
      await recalcVariantPrice(listing.variant_id);
    } catch (e: any) {
      console.error(`Prijsherstel mislukt voor variant ${listing.variant_id}:`, e);
    }
  }

  const consigner = consignersTable.findById(listing.consigner_id);
  if (consigner?.discord_webhook_url) {
    try {
      await sendDiscordNotification(
        consigner.discord_webhook_url,
        listing,
        trimmedOrderName
      );
    } catch (e) {
      console.error("Discord notificatie mislukt:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
