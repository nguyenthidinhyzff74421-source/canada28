/**
 * PC28 Prediction Algorithms Collection
 * Including the e-Rand Seed Algorithm from the provided code
 */

import { DrawResult, Combination, ALL_COMBINATIONS, getCombination, parseNumberDetail } from "./pc28";

export interface AlgorithmInfo {
  id: string;
  name: string;
  description: string;
  type: "shuangzu" | "sanmen";
}

// ============ E-RAND SEED ALGORITHM CORE ============
// From: 弃权·e值Rand种子判断

const SEQUENCES = [
  [0, 3, 9, 12, 15, 18, 21, 24, 27],
  [1, 4, 7, 10, 13, 16, 19, 22, 25],
  [2, 5, 8, 11, 14, 17, 20, 23, 26]
];

const E_RULES: Record<string, Record<Combination, Combination[]>> = {
  same: {
    "小双": ["小双", "大双", "大单"],
    "小单": ["小单", "大单", "大双"],
    "大双": ["大双", "小双", "小单"],
    "大单": ["大单", "小双", "小单"]
  },
  diff: {
    "小双": ["小双", "小单", "大单"],
    "小单": ["小单", "小双", "大双"],
    "大双": ["大双", "大单", "小单"],
    "大单": ["大单", "大双", "小双"]
  }
};

// Mulberry32 PRNG
function mulberry32(seed: number): () => number {
  let a = seed;
  return function() {
    a = (a | 0) + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, a | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Split number into digits and sum
function splitSum(n: number): number {
  return n.toString().replace('.', '').split('').reduce((a, b) => a + parseInt(b), 0);
}

// Check if two numbers are in same sequence
function isSameSeq(a: number, b: number): boolean {
  const ia = SEQUENCES.findIndex(s => s.includes(a));
  const ib = SEQUENCES.findIndex(s => s.includes(b));
  return ia !== -1 && ia === ib;
}

// Get prediction groups using e-Rand algorithm
function getERandGroups(seed: number, period: string, sum: number): Combination[] {
  const rng = mulberry32(seed + parseInt(period));
  const rand = Number(rng().toFixed(8));
  const prod = rand * sum;
  const finalSum = splitSum(Number(prod.toFixed(3)));
  const type = getCombination(finalSum);
  const randStr = rand.toFixed(8).split('.')[1]?.slice(0, 3) || "000";
  const randSum = splitSum(parseInt(randStr));
  const same = isSameSeq(randSum, sum);
  return same ? E_RULES.same[type].slice() : E_RULES.diff[type].slice();
}

// Get kill group from e-Rand groups
function getERandKill(groups: Combination[]): Combination {
  const big = groups.filter(g => g.startsWith('大'));
  if (big.length >= 2) return big[1];
  if (big.length === 1) return big[0];
  return groups[0];
}

// ============ SHUANGZU ALGORITHMS (10种) ============

function shuangzuFrequencyReversion(history: DrawResult[]): [Combination, Combination] {
  const counts = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => counts.set(c, 0));
  history.slice(0, 20).forEach((d) => counts.set(d.combination, (counts.get(d.combination) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
  return [sorted[0][0], sorted[1][0]];
}

function shuangzuGapAnalysis(history: DrawResult[]): [Combination, Combination] {
  const gaps = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => {
    const idx = history.findIndex((d) => d.combination === c);
    gaps.set(c, idx === -1 ? history.length : idx);
  });
  const sorted = [...gaps.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function shuangzuTrendFollow(history: DrawResult[]): [Combination, Combination] {
  const counts = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => counts.set(c, 0));
  history.slice(0, 8).forEach((d, i) => {
    counts.set(d.combination, (counts.get(d.combination) || 0) + (8 - i));
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function shuangzuBalance(history: DrawResult[]): [Combination, Combination] {
  const recent = history.slice(0, 15);
  let big = 0, odd = 0;
  recent.forEach((d) => { if (d.num >= 14) big++; if (d.num % 2 !== 0) odd++; });
  const bigR = big / recent.length, oddR = odd / recent.length;
  
  if (bigR > 0.55 && oddR > 0.55) return ["小双", "小单"];
  if (bigR > 0.55 && oddR < 0.45) return ["小单", "小双"];
  if (bigR < 0.45 && oddR > 0.55) return ["大双", "大单"];
  if (bigR < 0.45 && oddR < 0.45) return ["大单", "大双"];
  return oddR > 0.5 ? ["大双", "小双"] : ["大单", "小单"];
}

function shuangzuDigitPattern(history: DrawResult[]): [Combination, Combination] {
  if (history.length < 5) return ["小双", "大单"];
  let sum = 0;
  history.slice(0, 5).forEach((d) => {
    sum += parseNumberDetail(d.numberDetail).reduce((a, b) => a + b, 0);
  });
  const idx1 = sum % 4, idx2 = (sum * 7 + 3) % 4;
  let c1 = ALL_COMBINATIONS[idx1], c2 = ALL_COMBINATIONS[idx2];
  if (c1 === c2) c2 = ALL_COMBINATIONS[(idx2 + 1) % 4];
  return [c1, c2];
}

function shuangzuHybrid(history: DrawResult[]): [Combination, Combination] {
  const scores = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => scores.set(c, 0));

  const window = history.slice(0, 15);
  const counts = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => counts.set(c, 0));
  window.forEach((d) => counts.set(d.combination, (counts.get(d.combination) || 0) + 1));
  const avg = window.length / 4;
  ALL_COMBINATIONS.forEach((c) => scores.set(c, (scores.get(c) || 0) + (avg - (counts.get(c) || 0)) * 0.5));

  ALL_COMBINATIONS.forEach((c) => {
    const idx = history.findIndex((d) => d.combination === c);
    scores.set(c, (scores.get(c) || 0) + Math.min(idx === -1 ? 10 : idx, 8) * 0.3);
  });

  if (history.length > 0) {
    const last = history[0].combination;
    let streak = 0;
    for (const d of history) { if (d.combination === last) streak++; else break; }
    if (streak >= 2) scores.set(last, (scores.get(last) || 0) - streak * 0.5);
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function shuangzuMarkov(history: DrawResult[]): [Combination, Combination] {
  if (history.length < 10) return ["小双", "大单"];
  
  const transitions = new Map<Combination, Map<Combination, number>>();
  ALL_COMBINATIONS.forEach(c => transitions.set(c, new Map(ALL_COMBINATIONS.map(x => [x, 0]))));
  
  for (let i = 1; i < Math.min(50, history.length); i++) {
    const from = history[i].combination;
    const to = history[i - 1].combination;
    const fromMap = transitions.get(from)!;
    fromMap.set(to, (fromMap.get(to) || 0) + 1);
  }
  
  const last = history[0].combination;
  const probs = transitions.get(last)!;
  const sorted = [...probs.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function shuangzuCycle(history: DrawResult[]): [Combination, Combination] {
  if (history.length < 20) return ["小双", "大单"];
  
  const scores = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach(c => scores.set(c, 0));
  
  [3, 4, 5, 7, 10].forEach(cycle => {
    if (history.length > cycle) {
      const combo = history[cycle].combination;
      scores.set(combo, (scores.get(combo) || 0) + 1);
    }
  });
  
  ALL_COMBINATIONS.forEach(c => {
    const idx = history.findIndex(d => d.combination === c);
    if (idx >= 4 && idx <= 8) scores.set(c, (scores.get(c) || 0) + 2);
  });
  
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

// E-Rand双组算法
function shuangzuERand(history: DrawResult[]): [Combination, Combination] {
  if (history.length < 2) return ["小双", "大单"];
  
  const last = history[0];
  // 使用固定种子进行预测（实际使用时可扫描最优种子）
  const seed = 12345;
  const groups = getERandGroups(seed, last.period, last.num);
  
  // 排除杀组，返回两个推荐
  const kill = getERandKill(groups);
  const doubles = groups.filter(g => g !== kill) as [Combination, Combination];
  
  if (doubles.length >= 2) return [doubles[0], doubles[1]];
  return [groups[0], groups[1]];
}

// E-Rand动态种子双组
function shuangzuERandDynamic(history: DrawResult[]): [Combination, Combination] {
  if (history.length < 10) return ["小双", "大单"];
  
  // 动态寻找最近表现好的种子
  let bestSeed = 1;
  let bestHit = 0;
  
  for (let seed = 1; seed <= 1000; seed++) {
    let hit = 0;
    for (let i = 0; i < Math.min(10, history.length - 1); i++) {
      const prev = history[i + 1];
      const real = history[i];
      const groups = getERandGroups(seed, prev.period, prev.num);
      if (real.num === 13 || real.num === 14 || groups.includes(real.combination)) {
        hit++;
      }
    }
    if (hit > bestHit) {
      bestHit = hit;
      bestSeed = seed;
    }
  }
  
  const last = history[0];
  const groups = getERandGroups(bestSeed, last.period, last.num);
  const kill = getERandKill(groups);
  const doubles = groups.filter(g => g !== kill);
  
  if (doubles.length >= 2) return [doubles[0] as Combination, doubles[1] as Combination];
  return [groups[0], groups[1]];
}

// ============ SANMEN ALGORITHMS (12种) ============

function sanmenKillHot(history: DrawResult[]): Combination {
  const counts = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => counts.set(c, 0));
  history.slice(0, 10).forEach((d) => counts.set(d.combination, (counts.get(d.combination) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function sanmenKillLast(history: DrawResult[]): Combination {
  return history.length > 0 ? history[0].combination : "大双";
}

function sanmenKillTrend(history: DrawResult[]): Combination {
  const r5 = history.slice(0, 5);
  const r15 = history.slice(0, 15);
  const trends = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => {
    const t5 = r5.filter((d) => d.combination === c).length / Math.max(r5.length, 1);
    const t15 = r15.filter((d) => d.combination === c).length / Math.max(r15.length, 1);
    trends.set(c, t5 - t15);
  });
  const sorted = [...trends.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function sanmenKillColdOpposite(history: DrawResult[]): Combination {
  const gaps = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => {
    const idx = history.findIndex((d) => d.combination === c);
    gaps.set(c, idx === -1 ? 100 : idx);
  });
  const sorted = [...gaps.entries()].sort((a, b) => b[1] - a[1]);
  const coldest = sorted[0][0];
  const opp: Record<Combination, Combination> = { "大单": "小双", "大双": "小单", "小单": "大双", "小双": "大单" };
  return opp[coldest];
}

function sanmenBalanceKill(history: DrawResult[]): Combination {
  const recent = history.slice(0, 12);
  let big = 0, odd = 0;
  recent.forEach((d) => { if (d.num >= 14) big++; if (d.num % 2 !== 0) odd++; });
  const bigR = big / recent.length, oddR = odd / recent.length;
  if (bigR > 0.58 && oddR > 0.58) return "大单";
  if (bigR > 0.58 && oddR < 0.42) return "大双";
  if (bigR < 0.42 && oddR > 0.58) return "小单";
  if (bigR < 0.42 && oddR < 0.42) return "小双";
  return history.length > 0 ? history[0].combination : "大双";
}

function sanmenHybridKill(history: DrawResult[]): Combination {
  const scores = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach((c) => scores.set(c, 0));

  history.slice(0, 10).forEach((d, i) => {
    scores.set(d.combination, (scores.get(d.combination) || 0) + (10 - i) * 0.1);
  });

  ALL_COMBINATIONS.forEach((c) => {
    const idx = history.findIndex((d) => d.combination === c);
    if (idx >= 5 || idx === -1) scores.set(c, (scores.get(c) || 0) - 2);
  });

  if (history.length > 0) scores.set(history[0].combination, (scores.get(history[0].combination) || 0) + 0.5);

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function sanmenStreakKill(history: DrawResult[]): Combination {
  if (history.length < 3) return "大双";
  
  const last = history[0].combination;
  let streak = 0;
  for (const d of history) {
    if (d.combination === last) streak++;
    else break;
  }
  
  if (streak >= 2) return last;
  
  const counts = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach(c => counts.set(c, 0));
  history.slice(0, 8).forEach(d => counts.set(d.combination, (counts.get(d.combination) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function sanmenPositionWeight(history: DrawResult[]): Combination {
  if (history.length < 10) return "大双";
  
  const weights = [1, 2, 3, 4, 5, 4, 3, 2, 1, 1];
  const scores = new Map<Combination, number>();
  ALL_COMBINATIONS.forEach(c => scores.set(c, 0));
  
  history.slice(0, 10).forEach((d, i) => {
    scores.set(d.combination, (scores.get(d.combination) || 0) + weights[i]);
  });
  
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function sanmenModuloKill(history: DrawResult[]): Combination {
  if (history.length < 5) return "大双";
  
  let sum = 0;
  history.slice(0, 5).forEach(d => sum += d.num);
  
  const idx = sum % 4;
  return ALL_COMBINATIONS[idx];
}

function sanmenAlternateKill(history: DrawResult[]): Combination {
  if (history.length < 4) return "大双";
  
  let bigSmallAlternate = true;
  let oddEvenAlternate = true;
  
  for (let i = 0; i < Math.min(4, history.length - 1); i++) {
    const curr = history[i];
    const next = history[i + 1];
    if ((curr.num >= 14) === (next.num >= 14)) bigSmallAlternate = false;
    if ((curr.num % 2 === 1) === (next.num % 2 === 1)) oddEvenAlternate = false;
  }
  
  const last = history[0];
  const lastBig = last.num >= 14;
  const lastOdd = last.num % 2 === 1;
  
  if (bigSmallAlternate) {
    if (lastBig) return lastOdd ? "大单" : "大双";
    else return lastOdd ? "小单" : "小双";
  }
  
  if (oddEvenAlternate) {
    if (lastOdd) return lastBig ? "大单" : "小单";
    else return lastBig ? "大双" : "小双";
  }
  
  return last.combination;
}

// ★★★ E-Rand种子杀组算法 ★★★
function sanmenERandKill(history: DrawResult[]): Combination {
  if (history.length < 2) return "大双";
  
  const last = history[0];
  const seed = 12345; // 固定种子
  const groups = getERandGroups(seed, last.period, last.num);
  return getERandKill(groups);
}

// ★★★ E-Rand动态种子杀组 ★★★
function sanmenERandDynamicKill(history: DrawResult[]): Combination {
  if (history.length < 10) return "大双";
  
  // 扫描寻找最优种子（简化版，实际可扫描更多）
  let bestSeed = 1;
  let bestHit = 0;
  
  for (let seed = 1; seed <= 500; seed++) {
    let hit = 0;
    for (let i = 0; i < Math.min(15, history.length - 1); i++) {
      const prev = history[i + 1];
      const real = history[i];
      const groups = getERandGroups(seed, prev.period, prev.num);
      const kill = getERandKill(groups);
      // 杀组命中 = 实际结果不是被杀的
      if (real.combination !== kill) {
        hit++;
      }
    }
    if (hit > bestHit) {
      bestHit = hit;
      bestSeed = seed;
    }
  }
  
  const last = history[0];
  const groups = getERandGroups(bestSeed, last.period, last.num);
  return getERandKill(groups);
}

// ============ ALGORITHM REGISTRY ============

export const SHUANGZU_ALGORITHMS: AlgorithmInfo[] = [
  { id: "sz_freq", name: "频率回归", description: "选近期最少的组合", type: "shuangzu" },
  { id: "sz_gap", name: "缺口分析", description: "选最久未出的组合", type: "shuangzu" },
  { id: "sz_trend", name: "趋势跟踪", description: "跟随近期热门", type: "shuangzu" },
  { id: "sz_balance", name: "平衡分析", description: "大小单双比例修正", type: "shuangzu" },
  { id: "sz_digit", name: "数位模式", description: "数位和模运算", type: "shuangzu" },
  { id: "sz_hybrid", name: "综合算法", description: "多因子加权评分", type: "shuangzu" },
  { id: "sz_markov", name: "马尔可夫", description: "转移概率预测", type: "shuangzu" },
  { id: "sz_cycle", name: "周期分析", description: "历史周期规律", type: "shuangzu" },
  { id: "sz_erand", name: "E-Rand种子", description: "e值随机种子算法", type: "shuangzu" },
  { id: "sz_erand_dyn", name: "E-Rand动态", description: "动态扫描最优种子", type: "shuangzu" },
];

export const SANMEN_ALGORITHMS: AlgorithmInfo[] = [
  { id: "sm_hot", name: "杀热号", description: "杀近期最热组合", type: "sanmen" },
  { id: "sm_last", name: "杀上期", description: "杀上期出现的", type: "sanmen" },
  { id: "sm_trend", name: "杀趋势", description: "杀上升趋势最强的", type: "sanmen" },
  { id: "sm_cold_opp", name: "杀冷对立", description: "杀最冷的对立面", type: "sanmen" },
  { id: "sm_balance", name: "平衡杀", description: "基于失衡杀号", type: "sanmen" },
  { id: "sm_hybrid", name: "综合杀", description: "多因子评分杀号", type: "sanmen" },
  { id: "sm_streak", name: "连续杀", description: "杀连续出现的", type: "sanmen" },
  { id: "sm_position", name: "位置权重", description: "位置加权杀号", type: "sanmen" },
  { id: "sm_modulo", name: "取模杀", description: "数字和取模杀", type: "sanmen" },
  { id: "sm_alternate", name: "交替杀", description: "交替模式杀号", type: "sanmen" },
  { id: "sm_erand", name: "E-Rand杀组", description: "e值种子判断杀组", type: "sanmen" },
  { id: "sm_erand_dyn", name: "E-Rand动态杀", description: "动态种子杀组", type: "sanmen" },
];

const shuangzuFunctions: Record<string, (h: DrawResult[]) => [Combination, Combination]> = {
  sz_freq: shuangzuFrequencyReversion,
  sz_gap: shuangzuGapAnalysis,
  sz_trend: shuangzuTrendFollow,
  sz_balance: shuangzuBalance,
  sz_digit: shuangzuDigitPattern,
  sz_hybrid: shuangzuHybrid,
  sz_markov: shuangzuMarkov,
  sz_cycle: shuangzuCycle,
  sz_erand: shuangzuERand,
  sz_erand_dyn: shuangzuERandDynamic,
};

const sanmenFunctions: Record<string, (h: DrawResult[]) => Combination> = {
  sm_hot: sanmenKillHot,
  sm_last: sanmenKillLast,
  sm_trend: sanmenKillTrend,
  sm_cold_opp: sanmenKillColdOpposite,
  sm_balance: sanmenBalanceKill,
  sm_hybrid: sanmenHybridKill,
  sm_streak: sanmenStreakKill,
  sm_position: sanmenPositionWeight,
  sm_modulo: sanmenModuloKill,
  sm_alternate: sanmenAlternateKill,
  sm_erand: sanmenERandKill,
  sm_erand_dyn: sanmenERandDynamicKill,
};

export function predictShuangzuWithAlgorithm(
  algorithmId: string,
  history: DrawResult[],
  nextPeriod: string
): { period: string; prediction: string } {
  const fn = shuangzuFunctions[algorithmId] || shuangzuHybrid;
  if (history.length < 5) return { period: nextPeriod, prediction: "小双大单" };
  const [c1, c2] = fn(history);
  return { period: nextPeriod, prediction: c1 + c2 };
}

export function predictSanmenWithAlgorithm(
  algorithmId: string,
  history: DrawResult[],
  nextPeriod: string
): { period: string; prediction: string } {
  const fn = sanmenFunctions[algorithmId] || sanmenHybridKill;
  if (history.length < 5) return { period: nextPeriod, prediction: "杀大双" };
  const kill = fn(history);
  return { period: nextPeriod, prediction: `杀${kill}` };
}

// Export E-Rand functions for external use
export { getERandGroups, getERandKill, mulberry32, splitSum, isSameSeq };
