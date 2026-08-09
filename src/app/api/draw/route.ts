import { NextResponse } from "next/server";
import { fetchLatestDraw } from "@/lib/data-fetcher";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchLatestDraw();
  return NextResponse.json(result);
}
