import { NextRequest } from "next/server";

/**
 * Bouw een absolute URL voor een NextResponse.redirect die ook werkt achter
 * een proxy (Railway, Vercel, etc.). Next.js' new URL(path, req.url) gebruikt
 * de interne host (localhost), wat tot een redirect naar localhost leidt.
 */
export function redirectTo(req: NextRequest, path: string): URL {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl.protocol.replace(":", "") ||
    "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;
  return new URL(path, `${proto}://${host}`);
}
