import { NextRequest, NextResponse } from "next/server";
import { notificationsTable } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const notifications = notificationsTable.listByConsigner(session.id);
  const notification = notifications.find((n) => n.id === id);
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  notificationsTable.delete(id);
  return NextResponse.json({ ok: true });
}
