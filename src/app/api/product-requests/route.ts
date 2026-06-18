import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { productRequestsTable, consignersTable } from "@/lib/db";
import { findProduct } from "@/lib/shopify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STOCKX_URL_RE = /^https:\/\/stockx\.com\//;

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  if (isAdmin(session.email)) {
    const requests = productRequestsTable.listAll().map((r) => {
      const c = consignersTable.findById(r.consigner_id);
      return { ...r, consigner_name: c?.name ?? "?", consigner_email: c?.email ?? "?" };
    });
    return NextResponse.json({ requests });
  }

  const requests = productRequestsTable.listByConsigner(session.id);
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  let body: { sku?: string; product_name?: string; stockx_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const sku = (body.sku ?? "").trim().toUpperCase();
  const product_name = (body.product_name ?? "").trim();
  const stockx_url = (body.stockx_url ?? "").trim();

  // Validation
  if (!sku) {
    return NextResponse.json({ error: "SKU is verplicht" }, { status: 400 });
  }
  if (!product_name) {
    return NextResponse.json({ error: "Productnaam is verplicht" }, { status: 400 });
  }
  if (!stockx_url || !STOCKX_URL_RE.test(stockx_url)) {
    return NextResponse.json(
      { error: "Alleen StockX links worden geaccepteerd" },
      { status: 400 }
    );
  }

  // Check if SKU already exists in Shopify
  try {
    const existing = await findProduct(sku);
    if (existing) {
      return NextResponse.json(
        {
          error:
            "Deze SKU staat al in de catalogus, ga terug en zoek opnieuw",
        },
        { status: 409 }
      );
    }
  } catch {
    // If Shopify lookup fails, continue — don't block the request
  }

  // Check for duplicate PENDING/APPROVED request
  const duplicate = productRequestsTable.findBySku(sku);
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "Deze SKU is al aangevraagd, je krijgt bericht zodra hij online staat",
      },
      { status: 409 }
    );
  }

  const request = productRequestsTable.insert({
    consigner_id: session.id,
    sku,
    product_name,
    stockx_url,
    status: "PENDING",
  });

  return NextResponse.json({ request }, { status: 201 });
}
