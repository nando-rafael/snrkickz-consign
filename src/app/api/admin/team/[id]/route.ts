import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { consignersTable, listingsTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managerId = parseInt(params.id);
  if (isNaN(managerId)) {
    return NextResponse.json({ error: "Invalid manager ID" }, { status: 400 });
  }

  const manager = consignersTable.findById(managerId);
  if (!manager || manager.role !== "ORDERMANAGER") {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  // Delete all listings by this manager
  const managerListings = listingsTable.listByConsigner(managerId);
  managerListings.forEach((l) => {
    listingsTable.markDelisted(l.id);
  });

  // Delete the manager
  const deleted = consignersTable.delete(managerId);
  if (!deleted) {
    return NextResponse.json({ error: "Failed to delete manager" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Order Manager deleted`,
  });
}

