import { NextRequest, NextResponse } from "next/server";
import { listingsTable, payoutsTable, consignersTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch all records — pass a very high limit to bypass the default 200-row cap
  const allListings = listingsTable.listAll(Number.MAX_SAFE_INTEGER);
  const allConsigners = consignersTable.listAll();
  const allPayouts = payoutsTable.listAll(Number.MAX_SAFE_INTEGER);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  allListings.forEach((l) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  // Consigner analysis
  const consignerListingCounts: Record<number, number> = {};
  allListings.forEach((l) => {
    consignerListingCounts[l.consigner_id] =
      (consignerListingCounts[l.consigner_id] || 0) + 1;
  });

  const consignerDetails = allConsigners
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      listingCount: consignerListingCounts[c.id] || 0,
      activeCount: allListings.filter(
        (l) => l.consigner_id === c.id && l.status === "ACTIVE"
      ).length,
      soldCount: allListings.filter(
        (l) => l.consigner_id === c.id && l.status === "SOLD"
      ).length,
      delistedCount: allListings.filter(
        (l) => l.consigner_id === c.id && l.status === "DELISTED"
      ).length,
    }))
    .sort((a, b) => b.listingCount - a.listingCount);

  // Find specific consigners
  const targetNames = ["Linus Matthis", "Linde", "Jaradat & Rolland GbR"];
  const targetConsigners = targetNames.map((name) => {
    const consigner = allConsigners.find(
      (c) => c.name.includes(name) || name.includes(c.name)
    );
    if (!consigner) return { name, found: false };

    const listings = allListings.filter(
      (l) => l.consigner_id === consigner.id
    );
    const byStatus: Record<string, number> = {};
    listings.forEach((l) => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });

    return {
      name,
      found: true,
      consignerId: consigner.id,
      email: consigner.email,
      totalListings: listings.length,
      byStatus,
      listings: listings.map((l) => ({
        id: l.id,
        sku: l.sku,
        product_title: l.product_title,
        size: l.size,
        status: l.status,
        created_at: l.created_at,
        variant_id: l.variant_id,
      })),
    };
  });

  // Orphan analysis
  // Listings whose consigner_id does not match any known consigner
  const consignerIdSet = new Set(allConsigners.map((c) => c.id));
  const orphanListings = allListings.filter(
    (l) => !consignerIdSet.has(l.consigner_id)
  );

  // Payouts whose listing_id does not match any known listing
  const listingIdSet = new Set(allListings.map((l) => l.id));
  const orphanPayouts = allPayouts.filter((p) => !listingIdSet.has(p.listing_id));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: {
      totalListings: allListings.length,
      totalConsigners: allConsigners.length,
      totalPayouts: allPayouts.length,
      statusBreakdown: statusCounts,
      orphanListings: orphanListings.length,
      orphanPayouts: orphanPayouts.length,
    },
    consignerDetails,
    targetConsigners,
    orphanListings: orphanListings.slice(0, 10),
    orphanPayouts: orphanPayouts.slice(0, 10),
  });
}
