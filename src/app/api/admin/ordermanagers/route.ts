import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, isAdmin } from "@/lib/auth";
import { consignersTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name: string; email: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, password } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  if (consignersTable.findByEmail(email)) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const manager = consignersTable.insert({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    role: "ORDERMANAGER",
    iban: null,
    discord_username: null,
    discord_webhook_url: null,
  });

  return NextResponse.json({
    success: true,
    manager,
  });
}

