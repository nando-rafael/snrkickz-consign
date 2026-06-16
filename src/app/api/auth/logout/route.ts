import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  destroySession();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
