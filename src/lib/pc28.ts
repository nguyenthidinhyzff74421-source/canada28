// PC28 Core definitions and utilities

export type Combination = "大单" | "大双" | "小单" | "小双";
export type KillTarget = "杀大单" | "杀大双" | "杀小单" | "杀小双";

export interface DrawResult {
  period: string;
  date: string;
  time: string;
  numberDetail: string; // "3+0+1"
  num: number;          // sum 0-27
  combination: Combination;
}

export interface ShuangzuPrediction {
  period: string;
  prediction: string; // e.g. "小双大单" (two combinations)
}

export interface SanmenPrediction {
  period: string;
  prediction: string; // e.g. "杀大双"
}

/**
 * Determine the combination category of a number (0-27)
 * 大: 14-27, 小: 0-13
 * 单: odd, 双: even
 */
export function getCombination(num: number): Combination {
  const isBig = num >= 14;
  const isOdd = num % 2 !== 0;
  if (isBig && isOdd) return "大单";
  if (isBig && !isOdd) return "大双";
  if (!isBig && isOdd) return "小单";
  return "小双";
}

/**
 * Parse the API response number format "3+0+1" to individual digits
 */
export function parseNumberDetail(detail: string): number[] {
  return detail.split("+").map(Number);
}

/**
 * Get the last 2 digits of a period number for display
 */
export function getPeriodShort(period: string): string {
  return period.slice(-2);
}

/**
 * Check if a shuangzu prediction is correct
 * Shuangzu predicts two combinations, the actual result should be one of them
 */
export function checkShuangzu(prediction: string, actual: Combination): boolean {
  // prediction format: "小双大单" - contains two 2-char combinations
  const pred1 = prediction.substring(0, 2) as Combination;
  const pred2 = prediction.substring(2, 4) as Combination;
  return actual === pred1 || actual === pred2;
}

/**
 * Check if a sanmen prediction is correct  
 * Sanmen predicts what to "kill" (杀), correct if actual is NOT the killed combination
 */
export function checkSanmen(prediction: string, actual: Combination): boolean {
  // prediction format: "杀大双" - kill one combination
  const killed = prediction.substring(1) as Combination;
  return actual !== killed;
}

// All four combinations
export const ALL_COMBINATIONS: Combination[] = ["大单", "大双", "小单", "小双"];
