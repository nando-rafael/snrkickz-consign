import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { listingsTable, payoutsTable, consignersTable } from "@/lib/db";
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
    console.error("[WEBHOOK] HMAC verification failed");
    return NextResponse.json({ error: "Ongeldige HMAC" }, { status: 401 });
  }

  let order: any;
  try { order = JSON.parse(rawBody); }
  catch { 
    console.error("[WEBHOOK] Failed to parse JSON");
    return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 }); 
  }

  const orderName: string = order?.name || `#${order?.order_number || "?"}`;
  const lineItems: any[] = order?.line_items || [];

  console.log(`[WEBHOOK] Order received: ${orderName}`);
  console.log(`[WEBHOOK] Line items count: ${lineItems.length}`);

  let matched = 0;
  const touchedVariants = new Set<string>();
  const discordNotifications: Array<{ consignerId: number; listing: any; orderName: string }> = [];

  for (const li of lineItems) {
    if (!li?.variant_id) {
      console.log(`[WEBHOOK] Skipping line item - no variant_id`);
      continue;
    }
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const qty: number = li?.quantity || 1;
    
    console.log(`[WEBHOOK] Processing variant: ${variantGid}, qty: ${qty}`);
    
    for (let i = 0; i < qty; i++) {
      const listing = listingsTable.findActiveByVariantLowestPayout(variantGid);
      if (!listing) {
        console.log(`[WEBHOOK] No active listing found for variant: ${variantGid}`);
        break;
      }
      console.log(`[WEBHOOK] Found listing ID ${listing.id}, marking as sold`);
      listingsTable.markSold(listing.id, orderName);
      payoutsTable.insert({
        consigner_id: listing.consigner_id,
        listing_id: listing.id,
        amount: listing.payout,
        order_name: orderName,
      });
      touchedVariants.add(variantGid);
      matched++;
      
      // Queue Discord notification
      discordNotifications.push({
        consignerId: listing.consigner_id,
        listing,
        orderName,
      });
    }
  }

  console.log(`[WEBHOOK] Matched ${matched} listings`);

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
