import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/url";
import bcrypt from "bcryptjs";
import { consignersTable } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  const user = consignersTable.findByEmail(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Onjuiste inloggegevens.")}`,
        req.url
      ),
      303
    );
  }

  await createSession({ id: user.id, email: user.email, name: user.name });
  return NextResponse.redirect(redirectTo(req, "/dashboard"), 303);
}
