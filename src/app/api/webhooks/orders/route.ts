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

// Helper function to extract size from line item
function extractSize(li: any): string {
  let size = "";
  
  // Method 1: Check properties array (custom fields added at checkout)
  if (li.properties && Array.isArray(li.properties)) {
    const sizeProperty = li.properties.find((p: any) => 
      p.name?.toLowerCase() === "size" || p.name?.toLowerCase() === "taille" || p.name?.toLowerCase() === "maat"
    );
    if (sizeProperty?.value) {
      return sizeProperty.value.toString().trim();
    }
  }
  
  // Method 2: Extract from variant_title (e.g., "Kayano 14 - EU 42" or "Kayano 14 White Ivory - Size 42")
  if (li.variant_title) {
    // Try EU size format
    let match = li.variant_title.match(/EU\s*(\d+(?:\.\d+)?)/i);
    if (match) return match[1];
    
    // Try "Size XX" format
    match = li.variant_title.match(/[Ss]ize[\s-]*(\d+(?:\.\d+)?)/);
    if (match) return match[1];
    
    // Try last numeric value in variant title (fallback)
    match = li.variant_title.match(/(\d+(?:\.\d+)?)\s*$/);
    if (match) return match[1];
  }
  
  // Method 3: Check SKU for size suffix (some stores put size at end)
  if (li.sku) {
    const parts = li.sku.split("-");
    const lastPart = parts[parts.length - 1];
    if (/^\d+/.test(lastPart)) {
      return lastPart.replace(/\D/g, "");
    }
  }
  
  return "";
}

// Helper function to extract payment method from order
function extractPaymentMethod(order: any): string {
  // Method 1: Check payment_gateway_names (most reliable)
  if (order.payment_gateway_names && Array.isArray(order.payment_gateway_names)) {
    if (order.payment_gateway_names.length > 0) {
      return order.payment_gateway_names[0];
    }
  }
  
  // Method 2: Check transactions array
  if (order.transactions && Array.isArray(order.transactions)) {
    const successfulTx = order.transactions.find((tx: any) => tx.status === "success");
    if (successfulTx?.gateway) {
      return successfulTx.gateway;
    }
  }
  
  // Method 3: Fallback to gateway
  if (order.gateway) {
    return order.gateway;
  }
  
  return "Unknown";
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
  const paymentMethod = extractPaymentMethod(order);
  const lineItems: any[] = order?.line_items || [];

  console.log(`[ORDER] ${orderName} - Payment method: ${paymentMethod}`);

  let matched = 0;
  const touchedVariants = new Set<string>();
  const discordNotifications: Array<{ consignerId: number; listing: any; orderName: string }> = [];
  const unmatchedItems: any[] = [];

  for (const li of lineItems) {
    if (!li?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const qty: number = li?.quantity || 1;
    let itemMatched = false;
    
    // Log all line items for Asics
    if (li.vendor?.toUpperCase() === "ASICS") {
      console.log(`[BROADCAST] Processing Asics item: "${li.title}"`);
      console.log(`[BROADCAST]   variant_title: "${li.variant_title}"`);
      console.log(`[BROADCAST]   SKU: "${li.sku}"`);
      console.log(`[BROADCAST]   properties: ${JSON.stringify(li.properties)}`);
    }
    
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
      
      discordNotifications.push({
        consignerId: listing.consigner_id,
        listing,
        orderName,
      });
    }

    // Track unmatched items for broadcast
    if (!itemMatched) {
      const size = extractSize(li);
      
      if (li.vendor?.toUpperCase() === "ASICS") {
        console.log(`[BROADCAST]   extracted size: "${size}"`);
      }

      unmatchedItems.push({
        lineItemId: li.id,
        variantId: li.variant_id,
        productId: li.product_id,
        productTitle: li.title,
        vendor: li.vendor,
        sku: li.sku,
        size: size,
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

    console.log(`[BROADCAST] Processing Asics broadcast order: ${item.productTitle}`);
    console.log(`[BROADCAST]   Size for Discord: "${item.size}"`);
    
    // Find Asics broadcast channel
    const asicsChannel = broadcastChannelsTable.listAll().find((ch) => 
      ch.brand.toUpperCase() === "ASICS" && Boolean(ch.active)
    );
    
    if (!asicsChannel) {
      console.log(`[BROADCAST] ❌ No active Asics channel found`);
      continue;
    }

    console.log(`[BROADCAST] ✅ Found Asics channel: ${asicsChannel.id}`);

    // Create broadcast order
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

    console.log(`[BROADCAST] Created broadcast order #${broadcastOrder.id}`);

    // Build Discord message
    const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "vibrant-motivation-production-a8c5.up.railway.app";
    const claimUrl = `https://${publicDomain}/broadcast/claim/${broadcastOrder.id}?token=${claimToken}`;
    const rejectUrl = `https://${publicDomain}/broadcast/reject/${broadcastOrder.id}?token=${claimToken}`;

    let discordMsg = `📦 **${orderName}** — Asics order\n\n**Product:** ${item.productTitle}\n**SKU:** ${item.sku}`;
    if (item.size) {
      discordMsg += `\n**Size:** EU ${item.size}`;
    }
    discordMsg += `\n\n✅ [CLAIM ORDER](${claimUrl})\n❌ [Can't fulfill](${rejectUrl})\n\nYou have 48 hours to claim.`;
    
    console.log(`[BROADCAST] Posting Discord message...\n${discordMsg}`);
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

