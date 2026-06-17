import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { listingsTable, payoutsTable, consignersTable } from "@/lib/db";
import { recalcVariantPrice } from "@/lib/pricing";
import { sendSoldNotification } from "@/lib/email";

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

  let matched = 0;
  const touchedVariants = new Set<string>();

  for (const li of lineItems) {
    if (!li?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${li.variant_id}`;
    const qty: number = li?.quantity || 1;
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

      try {
        const consigner = consignersTable.findById(listing.consigner_id);
        if (consigner) {
          await sendSoldNotification(
            consigner.email,
            consigner.name,
            listing.product_title ?? listing.sku,
            listing.sku,
            listing.size,
            listing.sale_price,
            listing.payout,
            orderName
          );
        }
      } catch (emailErr) {
        console.error(`Failed to send sold notification for listing ${listing.id}:`, emailErr);
      }
    }
  }

  for (const v of Array.from(touchedVariants)) {
    try { await recalcVariantPrice(v); }
    catch (e) { console.error(`Prijsherstel mislukt voor ${v}:`, e); }
  }

  return NextResponse.json({ ok: true, matched });
}
