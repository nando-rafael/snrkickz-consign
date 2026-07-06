import { NextRequest, NextResponse } from "next/server";
import { listingsTable, consignersTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { generateShippingLabel } from "@/lib/label-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const listing = listingsTable.findById(Number(params.id));
  if (!listing) {
    return NextResponse.json({ error: "Listing niet gevonden" }, { status: 404 });
  }

  // Only the consignor who owns the listing or an admin may download
  if (!isAdmin(session.email) && listing.consigner_id !== session.id) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const consigner = consignersTable.findById(listing.consigner_id);
  if (!consigner) {
    return NextResponse.json({ error: "Consignor niet gevonden" }, { status: 404 });
  }

  try {
    const pdfBuffer = await generateShippingLabel({
      id: listing.id,
      sku: listing.sku,
      product_title: listing.product_title,
      size: listing.size,
      payout: listing.payout,
      consigner_name: consigner.name,
      order_name: listing.order_name,
    });

    const filename = `label-${listing.id}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Label Download] Error:", error);
    return NextResponse.json(
      { error: "Label genereren mislukt", message: error.message },
      { status: 500 }
    );
  }
}
