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

export async function POST(req: NextRequest) {
  // Guard with CRON_SECRET
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const pendingOrders = broadcastOrdersTable.listPending();
  const processed = [];

  for (const order of pendingOrders) {
    const createdAt = new Date(order.created_at);
    const channel = broadcastChannelsTable.findById(order.broadcast_channel_id);

    if (!channel) continue;

    // 4 hour reminder
    if (createdAt < fourHoursAgo && !order.notes?.includes("4h_reminder_sent")) {
      const reminderMsg = `⏰ Reminder: ${order.shopify_order_name} nog niet geclaimd — al 4u open. ${order.product_title} (${order.sku} maat ${order.size})`;
      await postDiscord(channel.discord_webhook_url, reminderMsg);

      // Mark reminder as sent via notes field
      const notes = order.notes ? order.notes + " | 4h_reminder_sent" : "4h_reminder_sent";
      broadcastOrdersTable.update(order.id, { notes });
      processed.push(`4h reminder sent for order ${order.id}`);
    }

    // 12 hour admin notification
    if (createdAt < twelveHoursAgo && !order.notes?.includes("12h_reminder_sent")) {
      const adminWebhook = process.env.ADMIN_DISCORD_WEBHOOK;
      if (adminWebhook) {
        const adminMsg = `🚨 12u unclaimed: ${order.shopify_order_name} — ${order.product_title} (${order.sku} maat ${order.size}). Supplier mogelijk niet actief.`;
        await postDiscord(adminWebhook, adminMsg);
      }

      // Mark reminder as sent via notes field
      const notes = order.notes ? order.notes + " | 12h_reminder_sent" : "12h_reminder_sent";
      broadcastOrdersTable.update(order.id, { notes });
      processed.push(`12h reminder sent for order ${order.id}`);
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    total: pendingOrders.length,
  });
}

