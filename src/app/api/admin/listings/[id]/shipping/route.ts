import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import type { ShippingCarrier } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_CARRIERS: ShippingCarrier[] = ["UPS", "DPD", "PostNL", "DHL", "Other"];

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

  const { carrier, trackingCode, labelUrl, note } = body as {
    carrier?: unknown;
    trackingCode?: unknown;
    labelUrl?: unknown;
    note?: unknown;
  };

  if (carrier !== undefined && !VALID_CARRIERS.includes(carrier as ShippingCarrier)) {
    return NextResponse.json(
      { error: `Ongeldige carrier. Kies uit: ${VALID_CARRIERS.join(", ")}` },
      { status: 400 }
    );
  }

  const updates: Parameters<typeof listingsTable.update>[1] = {};

  if (carrier !== undefined) updates.shipping_carrier = carrier as ShippingCarrier;
  if (typeof trackingCode === "string") updates.shipping_tracking_code = trackingCode || null;
  if (typeof labelUrl === "string") updates.shipping_label_url = labelUrl || null;
  if (typeof note === "string") updates.shipping_note = note || null;

  // If shipping_status is null, set to AWAITING_LABEL
  if (listing.shipping_status === null) {
    updates.shipping_status = "AWAITING_LABEL";
  }

  // Advance to LABEL_SENT when carrier/tracking/label are provided
  if (
    listing.shipping_status === "AWAITING_LABEL" &&
    (updates.shipping_carrier || listing.shipping_carrier) &&
    (updates.shipping_tracking_code || listing.shipping_tracking_code) &&
    (updates.shipping_label_url || listing.shipping_label_url)
  ) {
    updates.shipping_status = "LABEL_SENT";
  }

  const updated = listingsTable.update(listing.id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }

  return NextResponse.json({ listing: updated });
}
