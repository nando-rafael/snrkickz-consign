import { NextRequest, NextResponse } from "next/server";
import { productRequestsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const request = productRequestsTable.findById(id);

  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Only the consignor who owns the request can delete it
  if (request.consigner_id !== session.id) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  try {
    productRequestsTable.delete(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Delete failed" },
      { status: 500 }
    );
  }
}
