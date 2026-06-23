import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;

  // Security: only allow PDF files with expected naming pattern
  if (!filename.endsWith(".pdf") || !filename.match(/^listing-\d+-\d+\.pdf$/)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", "labels", filename);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
