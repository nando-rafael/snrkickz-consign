import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const { labelUrl } = body as { labelUrl?: unknown };

  if (!labelUrl || typeof labelUrl !== "string" || !labelUrl.trim()) {
    return NextResponse.json({ error: "labelUrl is verplicht" }, { status: 400 });
  }

  const updated = listingsTable.update(listing.id, {
    shipping_label_url: labelUrl.trim(),
  });

  if (!updated) {
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, labelUrl: updated.shipping_label_url });
}
