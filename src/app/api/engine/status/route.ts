import { NextResponse } from "next/server";
import { getEngineStatus, startEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";

let started = false;

export async function GET() {
  if (!started) {
    started = true;
    startEngine().catch((e) => console.error("[status] startEngine failed:", e));
  }
  const status = getEngineStatus();
  return NextResponse.json(status);
}
