import { NextResponse } from "next/server";
import { startEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";

let started = false;

export async function GET() {
  if (!started) {
    started = true;
    startEngine().catch((e) => console.error("[keepalive] failed:", e));
  }
  return NextResponse.json({ ok: true, ts: Date.now() });
}
