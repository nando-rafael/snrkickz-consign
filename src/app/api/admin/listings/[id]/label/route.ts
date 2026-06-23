import { NextRequest, NextResponse } from "next/server";
import { listingsTable } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const listing = listingsTable.findById(Number(params.id));
  if (!listing) {
    return NextResponse.json({ error: "Listing niet gevonden" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ongeldige form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Geen bestand gevonden" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Alleen PDF bestanden zijn toegestaan" }, { status: 400 });
  }

  const filename = `listing-${listing.id}-${Date.now()}.pdf`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "labels");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  const labelUrl = `/uploads/labels/${filename}`;

  const updated = listingsTable.update(listing.id, {
    shipping_label_url: labelUrl,
  });

  if (!updated) {
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, labelUrl: updated.shipping_label_url });
}
