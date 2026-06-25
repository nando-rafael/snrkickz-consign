import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { listingsTable, payoutsTable, consignersTable, webhookLogsTable } from "@/lib/db";
import { recalcVariantPrice } from "@/lib/pricing";
import { sendDiscordNotification } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader)); }
  catch { return false; }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Ongeldige HMAC" }, { status: 401 });
  }

  let order: any;
  try { order = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 }); }

  const orderName: string = order?.name || `#${order?.order_number || "?"}`;
  const lineItems: any[] = order?.line_items || [];

  console.log(`[Order Webhook] Processing order ${orderName} with ${lineItems.length} items`);

  // Create a log entry for this webhook attempt
  const webhookLog = webhookLogsTable.insert({
    event_type: "orders/paid",
    order_name: orderName,
    status: "PENDING_RETRY",
    matched_count: 0,
    error_message: null,
    raw_payload: rawBody,
    retry_count: 0,
  });

  let matched = 0;
  const touchedVariants = new Set<string>();
  const discordNotifications: Array<{ consignerId: number; listing: any; orderName: string }> = [];

  try {
    for (const li of lineItems) {
      if (!li?.variant_id) {
        console.warn(`[Order Webhook] Line item missing variant_id:`, li);
        continue;
      }
      const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
      const qty: number = li?.quantity || 1;

      console.log(`[Order Webhook] Processing variant ${variantGid}, qty ${qty}`);

      for (let i = 0; i < qty; i++) {
        const listing = listingsTable.findActiveByVariantLowestPayout(variantGid);
        if (!listing) {
          console.warn(`[Order Webhook] No active listing found for variant ${variantGid} (unit ${i + 1}/${qty})`);
          break;
        }

        try {
          listingsTable.markSold(listing.id, orderName);
          payoutsTable.insert({
            consigner_id: listing.consigner_id,
            listing_id: listing.id,
            amount: listing.payout,
            order_name: orderName,
          });
          touchedVariants.add(variantGid);
          matched++;
          console.log(`[Order Webhook] Marked listing ${listing.id} as sold (variant ${variantGid})`);

          // Queue Discord notification
          discordNotifications.push({
            consignerId: listing.consigner_id,
            listing,
            orderName,
          });
        } catch (e) {
          console.error(`[Order Webhook] Error marking listing ${listing.id} as sold:`, e);
        }
      }
    }

    console.log(`[Order Webhook] Order ${orderName} complete: ${matched} listings matched`);
    webhookLogsTable.updateStatus(webhookLog.id, "SUCCESS");
    webhookLog.matched_count = matched;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[Order Webhook] Fatal error processing order ${orderName}:`, e);
    webhookLogsTable.updateStatus(webhookLog.id, "FAILED", errMsg);
  }

  for (const v of Array.from(touchedVariants)) {
    try { await recalcVariantPrice(v); }
    catch (e) { console.error(`Prijsherstel mislukt voor ${v}:`, e); }
  }

  // Send Discord notifications
  for (const notif of discordNotifications) {
    const consigner = consignersTable.findById(notif.consignerId);
    if (consigner?.discord_webhook_url) {
      await sendDiscordNotification(
        consigner.discord_webhook_url,
        notif.listing,
        notif.orderName
      );
    }
  }

  return NextResponse.json({ ok: true, matched });
}

