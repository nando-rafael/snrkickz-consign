import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { listingsTable, payoutsTable, consignersTable, broadcastOrdersTable, broadcastChannelsTable } from "@/lib/db";
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

function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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

  let matched = 0;
  const touchedVariants = new Set<string>();
  const discordNotifications: Array<{ consignerId: number; listing: any; orderName: string }> = [];
  const unmatchedItems: any[] = [];

  for (const li of lineItems) {
    if (!li?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const qty: number = li?.quantity || 1;
    let itemMatched = false;
    
    for (let i = 0; i < qty; i++) {
      const listing = listingsTable.findActiveByVariantLowestPayout(variantGid);
      if (!listing) break;
      listingsTable.markSold(listing.id, orderName);
      payoutsTable.insert({
        consigner_id: listing.consigner_id,
        listing_id: listing.id,
        amount: listing.payout,
        order_name: orderName,
      });
      touchedVariants.add(variantGid);
      matched++;
      itemMatched = true;
      
      // Queue Discord notification
      discordNotifications.push({
        consignerId: listing.consigner_id,
        listing,
        orderName,
      });
    }

    // Track unmatched items for broadcast
    if (!itemMatched) {
      unmatchedItems.push({
        lineItemId: li.id,
        variantId: li.variant_id,
        productId: li.product_id,
        productTitle: li.title,
        vendor: li.vendor,
        sku: li.sku,
        size: li.properties?.find((p: any) => p.name === "Size")?.value || "?",
        quantity: qty,
        imageUrl: li.image?.src || null,
        price: li.price,
        salePrice: parseFloat(li.price || "0"),
      });
    }
  }

  // Check unmatched items against broadcast channels (Asics filter)
  for (const item of unmatchedItems) {
    // Only match Asics brand/vendor
    if (!item.vendor || item.vendor.toUpperCase() !== "ASICS") {
      continue;
    }

    // Find Asics broadcast channel
    const asicsChannel = broadcastChannelsTable.listAll().find(
      (ch) => ch.brand.toUpperCase() === "ASICS" && ch.active
    );
    
    if (!asicsChannel) {
      console.log(`Asics order detected maar geen active channel configured`);
      continue;
    }

    // Create broadcast order for Asics
    const claimToken = generateClaimToken();
    const broadcastOrder = broadcastOrdersTable.insert({
      shopify_order_id: order.id?.toString() || "",
      shopify_order_name: orderName,
      line_item_id: item.lineItemId,
      product_title: item.productTitle,
      sku: item.sku,
      size: item.size,
      image_url: item.imageUrl,
      quantity: item.quantity,
      variant_id: item.variantId,
      product_id: item.productId,
      sale_price: item.salePrice,
      broadcast_channel_id: asicsChannel.id,
      status: "PENDING",
      claimed_by_supplier_email: null,
      claimed_at: null,
      rejected_at: null,
      claim_token: claimToken,
      payout_amount: Math.round(item.salePrice * (asicsChannel.default_payout_percentage / 100) * 100) / 100,
      notes: null,
    });

    // Post Discord to Asics supplier with claim link
    const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "vibrant-motivation-production-a8c5.up.railway.app";
    const claimUrl = `https://${publicDomain}/broadcast/claim/${broadcastOrder.id}?token=${claimToken}`;
    const rejectUrl = `https://${publicDomain}/broadcast/reject/${broadcastOrder.id}?token=${claimToken}`;

    const discordMsg = `📦 **${orderName}** — Asics order\n\n**Product:** ${item.productTitle}\n**SKU:** ${item.sku}\n**Size:** EU ${item.size}\n**Price:** €${item.salePrice.toFixed(2)}\n**Your payout:** €${broadcastOrder.payout_amount.toFixed(2)}\n\n✅ [CLAIM ORDER](${claimUrl})\n❌ [Can't fulfill](${rejectUrl})\n\nYou have 48 hours to claim.`;
    
    await postDiscord(asicsChannel.discord_webhook_url, discordMsg);
  }

  for (const v of Array.from(touchedVariants)) {
    try { await recalcVariantPrice(v); }
    catch (e) { console.error(`Prijsherstel mislukt voor ${v}:`, e); }
  }

  // Send Discord notifications to consigners
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

  return NextResponse.json({ ok: true, matched, broadcast: unmatchedItems.length });
}

