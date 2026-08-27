import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { broadcastChannelsTable } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const channels = broadcastChannelsTable.listAll();
  return NextResponse.json({ channels });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const channel = broadcastChannelsTable.insert({
    brand: body.brand,
    match_type: body.match_type || "VENDOR",
    match_value: body.match_value,
    discord_webhook_url: body.discord_webhook_url,
    supplier_email: body.supplier_email,
    default_payout_percentage: body.default_payout_percentage || 40,
    active: true,
  });

  return NextResponse.json({ channel }, { status: 201 });
}

