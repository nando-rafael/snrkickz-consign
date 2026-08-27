import { NextRequest, NextResponse } from "next/server";
import { broadcastOrdersTable, broadcastChannelsTable } from "@/lib/db";

async function postDiscord(webhookUrl: string, message: string) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (e) {
    console.error("Discord post failed:", e);
  }
}

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

  if (order.status === "REJECTED") {
    return NextResponse.json(
      {
        order,
        message: "Deze order is eerder afgewezen",
      },
      { status: 200 }
    );
  }

  if (order.status === "CLAIMED") {
    return NextResponse.json(
      {
        order,
        message: `Deze order is al geclaimd`,
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

  const channel = broadcastChannelsTable.findById(order.broadcast_channel_id);
  if (!channel) {
    return NextResponse.json({ error: "Channel niet gevonden" }, { status: 500 });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  broadcastOrdersTable.update(orderId, {
    status: "REJECTED",
    rejected_at: now,
  });

  // Post to supplier Discord
  const supplierMsg = `❌ ${order.shopify_order_name} kon niet geleverd worden — ${order.product_title} (${order.sku} maat ${order.size}). Snrkickz gaat zelf sourcen.`;
  await postDiscord(channel.discord_webhook_url, supplierMsg);

  // Post to admin Discord if webhook is configured
  const adminWebhook = process.env.ADMIN_DISCORD_WEBHOOK;
  if (adminWebhook) {
    const adminMsg = `⚠️ Reject: ${order.shopify_order_name} — ${order.product_title} (${order.sku} maat ${order.size}). Sourcing nodig.`;
    await postDiscord(adminWebhook, adminMsg);
  }

  return NextResponse.json({
    success: true,
    message: "Bedankt voor de melding. Snrkickz sourcet dit paar zelf.",
  });
}

