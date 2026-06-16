import { NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/lib/url";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  destroySession();
  return NextResponse.redirect(redirectTo(req, "/login"), 303);
}
