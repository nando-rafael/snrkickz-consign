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

  const listing = listingsTable.findById(Number(params.id));
  if (!listing) {
    return NextResponse.json({ error: "Listing niet gevonden" }, { status: 404 });
  }

  if (listing.status !== "SOLD") {
    return NextResponse.json(
      { error: "Alleen SOLD listings kunnen opnieuw worden gestuurd" },
      { status: 400 }
    );
  }

  const consigner = consignersTable.findById(listing.consigner_id);
  if (!consigner) {
    return NextResponse.json({ error: "Consignor niet gevonden" }, { status: 404 });
  }

  if (!consigner.discord_webhook_url) {
    return NextResponse.json(
      { error: "Consignor heeft geen Discord webhook ingesteld" },
      { status: 400 }
    );
  }

  try {
    const discordResult = await sendDiscordNotification(
      consigner.discord_webhook_url,
      listing,
      listing.order_name || "Unknown"
    );

    if (!discordResult.ok) {
      console.error(
        `[Resend-Discord] Notification failed for listing ${listing.id}:`,
        discordResult.error
      );
      return NextResponse.json(
        { error: discordResult.error || "Discord verzenden mislukt" },
        { status: 500 }
      );
    }

    console.log(`[Resend-Discord] Notification sent for listing ${listing.id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(
      `[Resend-Discord] Notification error for listing ${listing.id}:`,
      e
    );
    return NextResponse.json(
      { error: `Discord fout: ${e.message}` },
      { status: 500 }
    );
  }
}
