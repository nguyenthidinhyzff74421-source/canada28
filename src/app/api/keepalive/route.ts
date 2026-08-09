import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Keep-alive endpoint — pinged every 4 minutes to prevent Render free-tier sleep.
 * Also used by the internal self-ping mechanism.
 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
