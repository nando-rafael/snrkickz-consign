import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { consignersTable } from "@/lib/db";
import { redirectTo } from "@/lib/url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(redirectTo(req, "/login"), 303);
  }

  const form = await req.formData();
  const discord_webhook_url = String(form.get("discord_webhook_url") || "").trim() || null;

  // Validate webhook URL format if provided
  if (discord_webhook_url && !discord_webhook_url.startsWith("https://discord.com/api/webhooks/")) {
    return NextResponse.redirect(
      redirectTo(req, `/dashboard/settings?error=${encodeURIComponent("Ongeldige Discord webhook URL")}`),
      303
    );
  }

  consignersTable.update(session.id, { discord_webhook_url });

  return NextResponse.redirect(
    redirectTo(req, `/dashboard/settings?success=${encodeURIComponent("Discord instellingen opgeslagen!")}`),
    303
  );
}

