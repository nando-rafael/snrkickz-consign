import { NextRequest, NextResponse } from "next/server";
import { consignersTable, listingsTable } from "@/lib/db";
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

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  const consigner = consignersTable.findById(id);
  if (!consigner) {
    return NextResponse.json({ error: "Consigner niet gevonden" }, { status: 404 });
  }

  try {
    // Delete all listings for this consigner
    const listings = listingsTable.listByConsigner(id);
    for (const listing of listings) {
      listingsTable.markDelisted(listing.id);
    }

    // Delete the consigner
    consignersTable.delete(id);

    return NextResponse.json({
      ok: true,
      message: `Consigner "${consigner.name}" verwijderd met ${listings.length} listings`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}
