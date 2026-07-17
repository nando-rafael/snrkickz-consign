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

  // Fetch updated listing with new status
  const updatedListing = listingsTable.findById(listing.id);

  // Send Discord notification with updated listing
  const consigner = consignersTable.findById(listing.consigner_id);
  if (consigner?.discord_webhook_url && updatedListing) {
    try {
      console.log(
        `[Mark Sold] Sending Discord notification for listing ${listing.id} to ${consigner.name}`
      );
      await sendDiscordNotification(
        consigner.discord_webhook_url,
        updatedListing,
        trimmedOrderName
      );
    } catch (e: any) {
      console.error(
        `[Mark Sold] Discord notificatie mislukt voor listing ${listing.id}:`,
        e.message
      );
    }
  } else {
    if (!consigner?.discord_webhook_url) {
      console.log(
        `[Mark Sold] No Discord webhook configured for consigner ${consigner?.name || listing.consigner_id}`
      );
    }
    if (!updatedListing) {
      console.error(`[Mark Sold] Updated listing not found for ID ${listing.id}`);
    }
  }

  return NextResponse.json({ ok: true });
}
