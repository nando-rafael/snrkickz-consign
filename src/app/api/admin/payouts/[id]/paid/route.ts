import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/url";
import { payoutsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  payoutsTable.markPaid(Number(params.id));
  return NextResponse.redirect(redirectTo(req, "/admin"), 303);
}
