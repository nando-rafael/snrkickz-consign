import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { broadcastOrdersTable, payoutsTable, broadcastChannelsTable } from "@/lib/db";
import type { BroadcastOrder } from "@/lib/db";

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = parseInt(params.id);
  const order = broadcastOrdersTable.findById(orderId);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { status } = (await req.json()) as { status?: BroadcastOrder["status"] };

  if (!status) {
    return NextResponse.json({ error: "Status required" }, { status: 400 });
  }

  // Handle PAID status - create payout record
  if (status === "PAID") {
    const channel = broadcastChannelsTable.findById(order.broadcast_channel_id);
    
    // Create a payout record for this broadcast order
    // Note: broadcast_order payout records use a synthetic consigner_id for tracking
    payoutsTable.insert({
      consigner_id: 0, // Synthetic ID for broadcast orders (not linked to actual consigner)
      listing_id: -(order.id), // Negative ID to distinguish from real listings
      amount: order.payout_amount,
      order_name: order.shopify_order_name,
    });
  }

  broadcastOrdersTable.update(orderId, { status });

  const updated = broadcastOrdersTable.findById(orderId);
  return NextResponse.json({ order: updated });
}

