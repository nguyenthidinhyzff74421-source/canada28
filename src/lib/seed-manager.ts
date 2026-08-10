/**
 * Seed Manager - E-Rand 种子扫描器
 * 基于浏览器版"弃权·e值Rand种子判断"移植
 */

import { DrawResult } from "./pc28";
import { getERandGroups, getERandKill } from "./algorithms";
import { db } from "@/db";
import { seedCache } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

const MAIN_SEED_TOTAL = 100000;
const KILL_SEED_TOTAL = 80000;
const BATCH_SIZE = 5000;
const MAX_STORE = 100;
const FULL_HIT_REQUIRED = 30;
const RESCAN_INTERVAL = 20;

let mainSeeds: number[] = [];
let killSeeds: number[] = [];
let lastScanPeriod = "";
let scanning = false;
let scanProgress = { type: "", percent: 0, found: 0 };

// 检查种子在最近 30 期是否全中
function isFullHit(seed: number, history: DrawResult[]): boolean {
  if (history.length < FULL_HIT_REQUIRED + 1) return false;
  for (let i = 0; i < FULL_HIT_REQUIRED; i++) {
    const real = history[i];
    const prev = history[i + 1];
    const groups = getERandGroups(seed, prev.period, prev.num);
    const passes = real.num === 13 || real.num === 14 || groups.includes(real.combination);
    if (!passes) return false;
  }
  return true;
}

// 计算种子命中数（用最多 100 期）
function calcHits(seed: number, history: DrawResult[]): number {
  const n = Math.min(100, history.length - 1);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const real = history[i];
    const prev = history[i + 1];
    const groups = getERandGroups(seed, prev.period, prev.num);
    if (real.num === 13 || real.num === 14 || groups.includes(real.combination)) {
      hits++;
    }
  }
  return hits;
}

// 分批扫描（不阻塞主线程）
async function scanSeedsAsync(
  total: number,
  history: DrawResult[],
  type: "main" | "kill"
): Promise<Array<{ seed: number; hits: number }>> {
  return new Promise((resolve) => {
    const results: Array<{ seed: number; hits: number }> = [];
    let current = 1;

    function processBatch() {
      const end = Math.min(current + BATCH_SIZE - 1, total);
      for (let s = current; s <= end; s++) {
        if (!isFullHit(s, history)) continue;
        const hits = calcHits(s, history);
        results.push({ seed: s, hits });
      }
      scanProgress.type = type;
      scanProgress.percent = Math.round((end / total) * 100);
      scanProgress.found = results.length;

      if (end < total) {
        current = end + 1;
        setImmediate(processBatch);
      } else {
        results.sort((a, b) => b.hits - a.hits);
        resolve(results.slice(0, MAX_STORE));
      }
    }

    setImmediate(processBatch);
  });
}

// 保存种子到数据库
async function saveSeeds(
  seedType: string,
  seeds: Array<{ seed: number; hits: number }>,
  totalTests: number
): Promise<void> {
  try {
    // 清空旧数据
    await db.delete(seedCache).where(eq(seedCache.seedType, seedType));
    // 插入新数据
    if (seeds.length > 0) {
      await db.insert(seedCache).values(
        seeds.map((s, idx) => ({
          seedType,
          seedValue: s.seed,
          hitCount: s.hits,
          totalTests,
          rank: idx + 1,
        }))
      );
    }
  } catch (e) {
    console.error(`[SeedManager] Failed to save ${seedType}:`, e);
  }
}

// 从数据库加载种子
async function loadSeeds(seedType: string): Promise<number[]> {
  try {
    const rows = await db
      .select()
      .from(seedCache)
      .where(eq(seedCache.seedType, seedType))
      .orderBy(desc(seedCache.hitCount));
    return rows.map((r) => r.seedValue);
  } catch (e) {
    console.error(`[SeedManager] Failed to load ${seedType}:`, e);
    return [];
  }
}

// ============ 公开 API ============

export async function initSeedManager(): Promise<void> {
  mainSeeds = await loadSeeds("main");
  killSeeds = await loadSeeds("kill");
  console.log(`[SeedManager] Loaded: main=${mainSeeds.length}, kill=${killSeeds.length}`);
}

export async function scanAllSeeds(history: DrawResult[]): Promise<void> {
  if (scanning) {
    console.log("[SeedManager] Already scanning, skip");
    return;
  }
  if (history.length < FULL_HIT_REQUIRED + 1) {
    console.log(`[SeedManager] Not enough history: ${history.length}`);
    return;
  }

  scanning = true;
  console.log(`[SeedManager] Start scanning with ${history.length} periods`);

  try {
    console.log("[SeedManager] Scanning MAIN seeds...");
    const main = await scanSeedsAsync(MAIN_SEED_TOTAL, history, "main");
    mainSeeds = main.map((s) => s.seed);
    await saveSeeds("main", main, MAIN_SEED_TOTAL);
    console.log(`[SeedManager] MAIN done: found ${main.length}`);

    console.log("[SeedManager] Scanning KILL seeds...");
    const kill = await scanSeedsAsync(KILL_SEED_TOTAL, history, "kill");
    killSeeds = kill.map((s) => s.seed);
    await saveSeeds("kill", kill, KILL_SEED_TOTAL);
    console.log(`[SeedManager] KILL done: found ${kill.length}`);

    lastScanPeriod = history[0].period;
  } finally {
    scanning = false;
    scanProgress = { type: "", percent: 0, found: 0 };
  }
}

// 检查是否需要重新扫描（每 20 期一次）
export function shouldRescan(currentPeriod: string): boolean {
  if (!lastScanPeriod) return true;
  const diff = parseInt(currentPeriod) - parseInt(lastScanPeriod);
  return diff >= RESCAN_INTERVAL;
}

// 获取最优主种子（第 3 名，短周期更准）
export function getBestMainSeed(): number | null {
  if (mainSeeds.length === 0) return null;
  const idx = mainSeeds.length >= 3 ? 2 : 0;
  return mainSeeds[idx];
}

// 获取最优杀组种子（第 3 名）
export function getBestKillSeed(): number | null {
  if (killSeeds.length === 0) return null;
  const idx = killSeeds.length >= 3 ? 2 : 0;
  return killSeeds[idx];
}

// 获取全部种子（前 N 个）
export function getTopMainSeeds(n: number = 10): number[] {
  return mainSeeds.slice(0, n);
}

export function getTopKillSeeds(n: number = 10): number[] {
  return killSeeds.slice(0, n);
}

// 状态查询
export function getSeedStatus() {
  return {
    scanning,
    progress: scanProgress,
    mainCount: mainSeeds.length,
    killCount: killSeeds.length,
    lastScanPeriod,
    bestMain: getBestMainSeed(),
    bestKill: getBestKillSeed(),
  };
}
