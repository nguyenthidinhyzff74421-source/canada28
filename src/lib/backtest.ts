/**
 * Backtesting Module for all algorithms
 */

import { DrawResult, checkShuangzu, checkSanmen } from "./pc28";
import {
  SHUANGZU_ALGORITHMS,
  SANMEN_ALGORITHMS,
  predictShuangzuWithAlgorithm,
  predictSanmenWithAlgorithm,
} from "./algorithms";

export interface BacktestResult {
  algorithmId: string;
  algorithmName: string;
  algorithmType: "shuangzu" | "sanmen";
  totalTests: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  maxConsecutiveCorrect: number;
  maxConsecutiveWrong: number;
}

export interface BacktestDetail {
  period: string;
  prediction: string;
  actual: string;
  isCorrect: boolean;
}

/**
 * Run backtest for a single shuangzu algorithm
 */
export function backtestShuangzuAlgorithm(
  algorithmId: string,
  history: DrawResult[]
): BacktestResult {
  const algo = SHUANGZU_ALGORITHMS.find((a) => a.id === algorithmId);
  const result: BacktestResult = {
    algorithmId,
    algorithmName: algo?.name || algorithmId,
    algorithmType: "shuangzu",
    totalTests: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    maxConsecutiveCorrect: 0,
    maxConsecutiveWrong: 0,
  };

  if (history.length < 10) return result;

  let consecutiveCorrect = 0;
  let consecutiveWrong = 0;

  // Test from older to newer
  for (let i = history.length - 6; i >= 1; i--) {
    const historyForPrediction = history.slice(i);
    const targetDraw = history[i - 1];

    const prediction = predictShuangzuWithAlgorithm(algorithmId, historyForPrediction, targetDraw.period);
    const isCorrect = checkShuangzu(prediction.prediction, targetDraw.combination);

    result.totalTests++;
    if (isCorrect) {
      result.correctCount++;
      consecutiveCorrect++;
      consecutiveWrong = 0;
      if (consecutiveCorrect > result.maxConsecutiveCorrect) {
        result.maxConsecutiveCorrect = consecutiveCorrect;
      }
    } else {
      result.wrongCount++;
      consecutiveWrong++;
      consecutiveCorrect = 0;
      if (consecutiveWrong > result.maxConsecutiveWrong) {
        result.maxConsecutiveWrong = consecutiveWrong;
      }
    }
  }

  result.accuracy = result.totalTests > 0 ? result.correctCount / result.totalTests : 0;
  return result;
}

/**
 * Run backtest for a single sanmen algorithm
 */
export function backtestSanmenAlgorithm(
  algorithmId: string,
  history: DrawResult[]
): BacktestResult {
  const algo = SANMEN_ALGORITHMS.find((a) => a.id === algorithmId);
  const result: BacktestResult = {
    algorithmId,
    algorithmName: algo?.name || algorithmId,
    algorithmType: "sanmen",
    totalTests: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    maxConsecutiveCorrect: 0,
    maxConsecutiveWrong: 0,
  };

  if (history.length < 10) return result;

  let consecutiveCorrect = 0;
  let consecutiveWrong = 0;

  for (let i = history.length - 6; i >= 1; i--) {
    const historyForPrediction = history.slice(i);
    const targetDraw = history[i - 1];

    const prediction = predictSanmenWithAlgorithm(algorithmId, historyForPrediction, targetDraw.period);
    const isCorrect = checkSanmen(prediction.prediction, targetDraw.combination);

    result.totalTests++;
    if (isCorrect) {
      result.correctCount++;
      consecutiveCorrect++;
      consecutiveWrong = 0;
      if (consecutiveCorrect > result.maxConsecutiveCorrect) {
        result.maxConsecutiveCorrect = consecutiveCorrect;
      }
    } else {
      result.wrongCount++;
      consecutiveWrong++;
      consecutiveCorrect = 0;
      if (consecutiveWrong > result.maxConsecutiveWrong) {
        result.maxConsecutiveWrong = consecutiveWrong;
      }
    }
  }

  result.accuracy = result.totalTests > 0 ? result.correctCount / result.totalTests : 0;
  return result;
}

/**
 * Run backtest for all algorithms
 */
export function backtestAllAlgorithms(history: DrawResult[]): {
  shuangzu: BacktestResult[];
  sanmen: BacktestResult[];
  bestShuangzu: BacktestResult | null;
  bestSanmen: BacktestResult | null;
} {
  const shuangzuResults = SHUANGZU_ALGORITHMS.map((algo) =>
    backtestShuangzuAlgorithm(algo.id, history)
  );

  const sanmenResults = SANMEN_ALGORITHMS.map((algo) =>
    backtestSanmenAlgorithm(algo.id, history)
  );

  // Find best by accuracy
  const bestShuangzu = shuangzuResults.length > 0
    ? shuangzuResults.reduce((a, b) => (a.accuracy > b.accuracy ? a : b))
    : null;

  const bestSanmen = sanmenResults.length > 0
    ? sanmenResults.reduce((a, b) => (a.accuracy > b.accuracy ? a : b))
    : null;

  return {
    shuangzu: shuangzuResults,
    sanmen: sanmenResults,
    bestShuangzu,
    bestSanmen,
  };
}

/**
 * Get detailed backtest results for display
 */
export function getBacktestDetails(
  algorithmId: string,
  algorithmType: "shuangzu" | "sanmen",
  history: DrawResult[],
  limit: number = 20
): BacktestDetail[] {
  const details: BacktestDetail[] = [];

  if (history.length < 10) return details;

  for (let i = history.length - 6; i >= 1 && details.length < limit; i--) {
    const historyForPrediction = history.slice(i);
    const targetDraw = history[i - 1];

    let prediction: string;
    let isCorrect: boolean;

    if (algorithmType === "shuangzu") {
      const pred = predictShuangzuWithAlgorithm(algorithmId, historyForPrediction, targetDraw.period);
      prediction = pred.prediction;
      isCorrect = checkShuangzu(prediction, targetDraw.combination);
    } else {
      const pred = predictSanmenWithAlgorithm(algorithmId, historyForPrediction, targetDraw.period);
      prediction = pred.prediction;
      isCorrect = checkSanmen(prediction, targetDraw.combination);
    }

    details.push({
      period: targetDraw.period,
      prediction,
      actual: targetDraw.combination,
      isCorrect,
    });
  }

  return details.reverse(); // Oldest first for display
}
