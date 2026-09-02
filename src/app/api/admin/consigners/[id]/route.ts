import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { consignersTable } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  const { role } = await req.json();

  if (!["CONSIGNER", "ORDERMANAGER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const consigner = consignersTable.findById(id);
  if (!consigner) {
    return NextResponse.json({ error: "Consigner not found" }, { status: 404 });
  }

  const updated = consignersTable.update(id, { role });
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, consigner: updated });
}

