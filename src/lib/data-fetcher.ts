import { DrawResult, Combination, getCombination } from "./pc28";

// Multiple API sources for redundancy and historical data
const API_SOURCES = {
  pc28help: "http://pc28.help/api/kj.json",
  pc28ai: "https://www.pc28.ai/api/kj.json",
};

export interface ApiResponse {
  countdown?: string;
  data: Array<{
    nbr: string;
    date: string;
    time: string;
    number: string;
    num: string;
    combination: string;
  }>;
  message?: string;
}

function parseDrawItem(item: ApiResponse["data"][0]): DrawResult {
  const num = parseInt(item.num, 10);
  return {
    period: item.nbr,
    date: item.date,
    time: item.time,
    numberDetail: item.number,
    num,
    combination: (item.combination || getCombination(num)) as Combination,
  };
}

/**
 * Fetch latest draw data
 */
export async function fetchLatestDraw(): Promise<{
  draw: DrawResult | null;
  countdown: string;
  error?: string;
}> {
  // Try primary source first
  for (const [name, url] of Object.entries(API_SOURCES)) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const data: ApiResponse = await response.json();
      if (!data.data || data.data.length === 0) continue;

      const draw = parseDrawItem(data.data[0]);
      return { draw, countdown: data.countdown || "00:00" };
    } catch {
      console.log(`API ${name} failed, trying next...`);
    }
  }

  return { draw: null, countdown: "00:00", error: "所有API源均不可用" };
}

/**
 * Fetch historical draws (up to 100 periods)
 */
export async function fetchHistoricalDraws(count: number = 50): Promise<{
  draws: DrawResult[];
  error?: string;
}> {
  const targetCount = Math.min(count, 100);

  // Try pc28.ai first (supports nbr parameter)
  try {
    const response = await fetch(
      `https://www.pc28.ai/api/kj.json?nbr=${targetCount}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (response.ok) {
      const data: ApiResponse = await response.json();
      if (data.data && data.data.length > 0) {
        return { draws: data.data.map(parseDrawItem) };
      }
    }
  } catch (e) {
    console.log("pc28.ai historical fetch failed:", e);
  }

  // Try pc28.help
  try {
    const response = await fetch(
      `http://pc28.help/api/kj.json?nbr=${targetCount}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (response.ok) {
      const data: ApiResponse = await response.json();
      if (data.data && data.data.length > 0) {
        return { draws: data.data.map(parseDrawItem) };
      }
    }
  } catch (e) {
    console.log("pc28.help historical fetch failed:", e);
  }

  return { draws: [], error: "无法获取历史数据" };
}

/**
 * Merge new draw into existing history
 */
export function mergeIntoHistory(
  existingHistory: DrawResult[],
  newDraws: DrawResult[]
): DrawResult[] {
  const periodSet = new Set(existingHistory.map((d) => d.period));
  const merged = [...existingHistory];

  for (const draw of newDraws) {
    if (!periodSet.has(draw.period)) {
      merged.push(draw);
      periodSet.add(draw.period);
    }
  }

  // Sort by period descending (newest first)
  merged.sort((a, b) => parseInt(b.period) - parseInt(a.period));

  // Keep max 200 records
  return merged.slice(0, 200);
}

/**
 * Get next period number
 */
export function getNextPeriod(currentPeriod: string): string {
  return String(parseInt(currentPeriod, 10) + 1);
}

/**
 * Parse countdown string to seconds
 */
export function parseCountdown(countdown: string): number {
  const parts = countdown.split(":");
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  if (parts.length === 3) {
    return (
      (parseInt(parts[0], 10) || 0) * 3600 +
      (parseInt(parts[1], 10) || 0) * 60 +
      (parseInt(parts[2], 10) || 0)
    );
  }
  return 0;
}
