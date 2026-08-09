import { NextResponse } from "next/server";
import { getEngineStatus } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getEngineStatus();
  return NextResponse.json(status);
}
