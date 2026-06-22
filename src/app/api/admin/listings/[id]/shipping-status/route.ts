import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import type { ShippingStatus } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES: ShippingStatus[] = [
  "LABEL_SENT",
  "IN_TRANSIT",
  "RECEIVED",
  "SHIPPED_TO_CUSTOMER",
];

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

  const { status } = body as { status?: unknown };

  if (!status || !VALID_STATUSES.includes(status as ShippingStatus)) {
    return NextResponse.json(
      { error: `Ongeldige status. Kies uit: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = listingsTable.update(listing.id, {
    shipping_status: status as ShippingStatus,
  });

  if (!updated) {
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }

  return NextResponse.json({ listing: updated });
}
