import { NextRequest, NextResponse } from "next/server";
import { listingsTable, consignersTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
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

  const listingId = parseInt(params.id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  const listing = listingsTable.findById(listingId);
  if (!listing) {
    return NextResponse.json({ error: "Listing niet gevonden" }, { status: 404 });
  }

  if (listing.status !== "SOLD") {
    return NextResponse.json(
      { error: "Listing is niet verkocht" },
      { status: 400 }
    );
  }

  const consigner = consignersTable.findById(listing.consigner_id);
  if (!consigner) {
    return NextResponse.json(
      { error: "Consigner niet gevonden" },
      { status: 404 }
    );
  }

  if (!consigner.discord_webhook_url) {
    return NextResponse.json(
      { error: "Consigner heeft geen Discord webhook ingesteld" },
      { status: 400 }
    );
  }

  try {
    await sendDiscordNotification(
      consigner.discord_webhook_url,
      listing,
      listing.order_name || "Onbekend"
    );

    return NextResponse.json({
      ok: true,
      message: "Discord notificatie opnieuw verzonden",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Discord notificatie verzenden mislukt" },
      { status: 500 }
    );
  }
}
