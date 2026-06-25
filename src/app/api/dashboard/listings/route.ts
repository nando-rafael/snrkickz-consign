import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listings = listingsTable.listByConsigner(session.id);
  const filtered = listings.filter((l) => l.status !== "DELISTED");

  return NextResponse.json({
    listings: filtered,
    total: filtered.length,
  });
}
