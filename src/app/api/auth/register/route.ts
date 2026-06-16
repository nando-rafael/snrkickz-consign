import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/url";
import bcrypt from "bcryptjs";
import { consignersTable } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const iban = String(form.get("iban") || "").trim() || null;

  const fail = (msg: string) =>
    NextResponse.redirect(redirectTo(req, `/register?error=${encodeURIComponent(msg)}`),
      303
    );

  if (!name || !email || password.length < 8) {
    return fail("Vul alle velden in. Wachtwoord minimaal 8 tekens.");
  }
  if (consignersTable.findByEmail(email)) {
    return fail("Dit e-mailadres is al geregistreerd.");
  }

  const hash = bcrypt.hashSync(password, 10);
  const row = consignersTable.insert({
    email,
    name,
    password_hash: hash,
    iban,
  });

  await createSession({ id: row.id, email, name });
  return NextResponse.redirect(redirectTo(req, "/dashboard"), 303);
}
