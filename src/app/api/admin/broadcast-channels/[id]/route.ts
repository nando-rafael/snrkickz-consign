import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { broadcastChannelsTable } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = parseInt(params.id);
  const body = await req.json();

  const updated = broadcastChannelsTable.update(id, {
    ...(body.brand && { brand: body.brand }),
    ...(body.match_type && { match_type: body.match_type }),
    ...(body.match_value && { match_value: body.match_value }),
    ...(body.discord_webhook_url && { discord_webhook_url: body.discord_webhook_url }),
    ...(body.supplier_email && { supplier_email: body.supplier_email }),
    ...(body.default_payout_percentage !== undefined && { default_payout_percentage: body.default_payout_percentage }),
    ...(body.active !== undefined && { active: body.active }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ channel: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = parseInt(params.id);
  const success = broadcastChannelsTable.delete(id);

  if (!success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

