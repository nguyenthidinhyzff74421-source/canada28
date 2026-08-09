import { NextResponse } from "next/server";
import { DrawResult, getCombination } from "@/lib/pc28";
import { backtestAllAlgorithms } from "@/lib/backtest";

export const dynamic = "force-dynamic";

/**
 * Test prediction algorithms with mock data
 */
export async function GET() {
  // Generate mock history
  const mockHistory: DrawResult[] = [];

  for (let i = 0; i < 50; i++) {
    const num = Math.floor(Math.random() * 28);
    mockHistory.push({
      period: String(20268800 + i),
      date: "2026-01-01",
      time: "12:00:00",
      numberDetail: `${Math.floor(num / 9)}+${Math.floor((num % 9) / 3)}+${num % 3}`,
      num,
      combination: getCombination(num),
    });
  }

  const results = backtestAllAlgorithms(mockHistory);

  return NextResponse.json({
    historySize: mockHistory.length,
    shuangzu: results.shuangzu,
    sanmen: results.sanmen,
    bestShuangzu: results.bestShuangzu,
    bestSanmen: results.bestSanmen,
  });
}
