import { NextRequest, NextResponse } from "next/server";
import { productRequestsTable } from "@/lib/db";
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

  const request = productRequestsTable.findById(id);

  if (!request) {
    return NextResponse.json({ error: "Request niet gevonden" }, { status: 404 });
  }

  try {
    productRequestsTable.delete(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}
