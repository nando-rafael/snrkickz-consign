import { NextRequest, NextResponse } from "next/server";
import { inventoryTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sku = String(body.sku || "").trim().toUpperCase();
  const product_title = String(body.product_title || "").trim();
  const size = String(body.size || "").trim();
  const quantity = parseInt(body.quantity, 10);

  if (!sku) {
    return NextResponse.json({ error: "SKU is verplicht" }, { status: 400 });
  }
  if (!product_title) {
    return NextResponse.json({ error: "Productnaam is verplicht" }, { status: 400 });
  }
  if (!size) {
    return NextResponse.json({ error: "Maat is verplicht" }, { status: 400 });
  }
  if (isNaN(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Vul een geldige hoeveelheid in" }, { status: 400 });
  }

  const row = inventoryTable.insert({ sku, product_title, size, quantity });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = parseInt(body.id, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Ongeldig id" }, { status: 400 });
  }

  const item = inventoryTable.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item niet gevonden" }, { status: 404 });
  }

  inventoryTable.delete(id);
  return NextResponse.json({ ok: true });
}
