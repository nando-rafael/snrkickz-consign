import { NextRequest, NextResponse } from "next/server";
import { broadcastOrdersTable, broadcastChannelsTable } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token ontbreekt" }, { status: 400 });
  }

  const orderId = parseInt(params.id);
  const order = broadcastOrdersTable.findById(orderId);

  if (!order || order.claim_token !== token) {
    return NextResponse.json({ error: "Order niet gevonden of token ongeldig" }, { status: 404 });
  }

  if (order.status === "CLAIMED") {
    return NextResponse.json(
      {
        order,
        message: `Deze order is al geclaimd op ${new Date(order.claimed_at!).toLocaleString("nl-NL")}`,
      },
      { status: 200 }
    );
  }

  if (order.status === "REJECTED") {
    return NextResponse.json(
      {
        order,
        message: "Deze order is eerder afgewezen",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ order });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token ontbreekt" }, { status: 400 });
  }

  const orderId = parseInt(params.id);
  const order = broadcastOrdersTable.findById(orderId);

  if (!order || order.claim_token !== token) {
    return NextResponse.json({ error: "Order niet gevonden of token ongeldig" }, { status: 404 });
  }

  // Race condition guard
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: `Order status is ${order.status}` }, { status: 400 });
  }

  // Get channel for supplier email
  const channel = broadcastChannelsTable.findById(order.broadcast_channel_id);
  if (!channel) {
    return NextResponse.json({ error: "Channel niet gevonden" }, { status: 500 });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  broadcastOrdersTable.update(orderId, {
    status: "CLAIMED",
    claimed_at: now,
    claimed_by_supplier_email: channel.supplier_email,
  });

  return NextResponse.json({
    success: true,
    message: "Order geclaimd. Verzend binnen 48u naar Snrkickz.",
  });
}

