import { type NextRequest, NextResponse } from "next/server";

import { getCurrentMember } from "@/lib/auth";
import { readLocalGameAsset } from "@/server/local-game-assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string; path: string[] }> },
) {
  if (!loopback(request.nextUrl.hostname)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { provider, path } = await context.params;
  const resolved = await readLocalGameAsset(provider, path);
  if (!resolved) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(Uint8Array.from(resolved.bytes), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": resolved.asset.media_type,
      "Content-Length": String(resolved.asset.byte_size),
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
