import { NextRequest, NextResponse } from "next/server";
import { consignersTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige request" }, { status: 400 });
  }

  const { email } = body as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is verplicht" }, { status: 400 });
  }

  const consigner = consignersTable.findByEmail(email);

  if (!consigner) {
    // Don't reveal if email exists (security)
    return NextResponse.json({
      ok: true,
      message: "Als dit e-mailadres in ons systeem staat, ontvang je een reset link.",
    });
  }

  // Generate a temporary reset code (simple approach)
  const resetCode =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  // Store reset code (in real app, save to database with expiry)
  const updated = consignersTable.update(consigner.id, {
    password_reset_token: resetCode,
    password_reset_expires: expiresAt.toISOString(),
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Kon reset niet instellen" },
      { status: 500 }
    );
  }

  // In a real app, send email here
  // For now, return the reset code (in production, remove this)
  return NextResponse.json({
    ok: true,
    message: "Controleer je e-mail voor reset instructies",
    resetCode, // Remove in production
  });
}
