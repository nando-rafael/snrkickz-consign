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

function extractSize(li: any): string {
  if (li.properties && Array.isArray(li.properties)) {
    const sizeProperty = li.properties.find((p: any) =>
      p.name?.toLowerCase() === "size" || p.name?.toLowerCase() === "taille" || p.name?.toLowerCase() === "maat"
    );
    if (sizeProperty?.value) return sizeProperty.value.toString().trim();
  }
  if (li.variant_title) {
    let match = li.variant_title.match(/EU\s*(\d+(?:\.\d+)?)/i);
    if (match) return match[1];
    match = li.variant_title.match(/[Ss]ize[\s-]*(\d+(?:\.\d+)?)/);
    if (match) return match[1];
    match = li.variant_title.match(/(\d+(?:\.\d+)?)\s*$/);
    if (match) return match[1];
  }
  if (li.sku) {
    const parts = li.sku.split("-");
    const lastPart = parts[parts.length - 1];
    if (/^\d+/.test(lastPart)) return lastPart.replace(/\D/g, "");
  }
  return "";
}

function extractPaymentMethod(order: any): string {
  if (order.payment_gateway_names && Array.isArray(order.payment_gateway_names)) {
    if (order.payment_gateway_names.length > 0) return order.payment_gateway_names[0];
  }
  if (order.transactions && Array.isArray(order.transactions)) {
    const successfulTx = order.transactions.find((tx: any) => tx.status === "success");
    if (successfulTx?.gateway) return successfulTx.gateway;
  }
  if (order.gateway) return order.gateway;
  return "Unknown";
}

function getPayoutTime(paymentMethod: string): { method: string; time: string } {
  const normalized = paymentMethod.toLowerCase().trim();
  if (normalized.includes("ideal")) return { method: "iDEAL", time: "48H" };
  if (normalized.includes("revolut")) return { method: "Revolut", time: "24H" };
  if (normalized.includes("klarna")) return { method: "Klarna", time: "9 Days" };
  return { method: paymentMethod, time: "Unknown" };
}

// Find matching broadcast channel for a line item based on active channels in database
// Supports match types: VENDOR, TITLE_CONTAINS, TAG
function findMatchingChannel(li: any): any | null {
  const allChannels = broadcastChannelsTable.listAll();
  const activeChannels = allChannels.filter((ch: any) => Boolean(ch.active));

  console.log(`[BROADCAST] Checking ${activeChannels.length} active channels for line item: "${li.title}" (vendor: "${li.vendor}")`);

  for (const ch of activeChannels) {
    const matchType = (ch.match_type || "VENDOR").toUpperCase();
    const matchValue = (ch.match_value || ch.brand || "").trim().toUpperCase();

    if (!matchValue) {
      console.log(`[BROADCAST]   Channel "${ch.brand}" skipped: no match_value`);
      continue;
    }

    let isMatch = false;
    let checkedValue = "";

    if (matchType === "VENDOR") {
      checkedValue = (li.vendor || "").trim().toUpperCase();
      isMatch = checkedValue === matchValue;
    } else if (matchType === "TITLE_CONTAINS" || matchType === "TITLE" || matchType === "TITEL_BEVAT") {
      checkedValue = (li.title || "").trim().toUpperCase();
      isMatch = checkedValue.includes(matchValue);
    } else if (matchType === "TAG") {
      const tags = Array.isArray(li.tags) ? li.tags : (li.tags || "").split(",");
      checkedValue = tags.join(",").toUpperCase();
      isMatch = tags.some((t: string) => t.trim().toUpperCase() === matchValue);
    }

    console.log(`[BROADCAST]   Channel "${ch.brand}" (${matchType}="${matchValue}"): checking against "${checkedValue}" → match=${isMatch}`);

    if (isMatch) {
      return ch;
    }
  }

  return null;
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
  const payoutInfo = getPayoutTime(paymentMethod);
  const lineItems: any[] = order?.line_items || [];
  console.log(`[ORDER] ${orderName} - Payment method: ${paymentMethod}, Payout time: ${payoutInfo.time}`);

  let matched = 0;
  const touchedVariants = new Set<string>();
  const discordNotifications: Array<{ consignerId: number; listing: any; orderName: string }> = [];
  const unmatchedItems: any[] = [];

  for (const li of lineItems) {
    if (!li?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const qty: number = li?.quantity || 1;
    let itemMatched = false;

    console.log(`[LINE] "${li.title}" vendor="${li.vendor}" sku="${li.sku}" variant="${li.variant_title}"`);

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
      discordNotifications.push({ consignerId: listing.consigner_id, listing, orderName });
    }

    if (!itemMatched) {
      const size = extractSize(li);
      unmatchedItems.push({
        lineItemId: li.id,
        variantId: li.variant_id,
        productId: li.product_id,
        productTitle: li.title,
        vendor: li.vendor,
        tags: li.tags,
        sku: li.sku,
        size: size,
        quantity: qty,
        imageUrl: li.image?.src || null,
        price: li.price,
        salePrice: parseFloat(li.price || "0"),
      });
    }
  }

  // Check unmatched items against ALL configured broadcast channels
  for (const item of unmatchedItems) {
    const channel = findMatchingChannel(item);

    if (!channel) {
      console.log(`[BROADCAST] ❌ No matching channel for "${item.productTitle}" (vendor: "${item.vendor}")`);
      continue;
    }

    console.log(`[BROADCAST] ✅ Matched channel "${channel.brand}" (id ${channel.id}) for "${item.productTitle}"`);

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
      broadcast_channel_id: channel.id,
      status: "PENDING",
      claimed_by_supplier_email: null,
      claimed_at: null,
      rejected_at: null,
      claim_token: claimToken,
      payout_amount: Math.round(item.salePrice * (channel.default_payout_percentage / 100) * 100) / 100,
      notes: null,
    });
    console.log(`[BROADCAST] Created broadcast order #${broadcastOrder.id}`);

    const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "vibrant-motivation-production-a8c5.up.railway.app";
    const claimUrl = `https://${publicDomain}/broadcast/claim/${broadcastOrder.id}?token=${claimToken}`;
    const rejectUrl = `https://${publicDomain}/broadcast/reject/${broadcastOrder.id}?token=${claimToken}`;

    const brandLabel = (channel.brand || "").toUpperCase();
    let discordMsg = `📦 **${orderName}** — ${brandLabel} order\n\n**Product:** ${item.productTitle}\n**SKU:** ${item.sku}`;
    if (item.size) discordMsg += `\n**Size:** EU ${item.size}`;
    discordMsg += `\n**Payment method:** ${payoutInfo.method}\n**Payout time:** ${payoutInfo.time}`;
    discordMsg += `\n\n✅ [CLAIM ORDER](${claimUrl})\n❌ [Can't fulfill](${rejectUrl})\n\nYou have 48 hours to claim.`;

    console.log(`[BROADCAST] Posting Discord message to channel ${channel.id}`);
    await postDiscord(channel.discord_webhook_url, discordMsg);
  }

  for (const v of Array.from(touchedVariants)) {
    try { await recalcVariantPrice(v); }
    catch (e) { console.error(`Prijsherstel mislukt voor ${v}:`, e); }
  }

  for (const notif of discordNotifications) {
    const consigner = consignersTable.findById(notif.consignerId);
    if (consigner?.discord_webhook_url) {
      await sendDiscordNotification(
        consigner.discord_webhook_url,
        notif.listing,
        notif.orderName,
        payoutInfo.method,
        payoutInfo.time
      );
    }
  }

  return NextResponse.json({ ok: true, matched, broadcast: unmatchedItems.length });
}
