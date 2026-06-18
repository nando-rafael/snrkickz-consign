import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { productRequestsTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  if (!isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const { action } = body;
  if (!action || !["approve", "reject", "live"].includes(action)) {
    return NextResponse.json(
      { error: "Ongeldige actie. Gebruik: approve, reject of live" },
      { status: 400 }
    );
  }

  const existing = productRequestsTable.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Request niet gevonden" }, { status: 404 });
  }

  const statusMap: Record<string, "APPROVED" | "REJECTED" | "LIVE"> = {
    approve: "APPROVED",
    reject: "REJECTED",
    live: "LIVE",
  };

  const handledAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const updated = productRequestsTable.updateStatus(id, statusMap[action], handledAt);

  return NextResponse.json({ request: updated });
}
