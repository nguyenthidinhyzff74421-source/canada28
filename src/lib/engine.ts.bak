/**
 * PC28 Prediction Engine v3
 * - Multiple algorithms to choose from
 * - Single algorithm mode (shuangzu OR sanmen)
 * - Two groups receive same predictions simultaneously
 */

import { DrawResult, getPeriodShort, checkShuangzu, checkSanmen } from "./pc28";
import {
  predictShuangzuWithAlgorithm,
  predictSanmenWithAlgorithm,
  SHUANGZU_ALGORITHMS,
  SANMEN_ALGORITHMS,
} from "./algorithms";
import { fetchLatestDraw, fetchHistoricalDraws, mergeIntoHistory, getNextPeriod } from "./data-fetcher";
import { backtestAllAlgorithms, BacktestResult } from "./backtest";
import {
  sendMessage,
  editMessage,
  sendPrivateMessage,
  getMessageLink,
  isClientConnected,
  autoReconnect,
} from "./telegram-client";
import {
  SessionState,
  PredictionEntry,
  LogEntry,
  GroupConfig,
  SHUANGZU_RULES,
  SANMEN_RULES,
} from "./types";

// Engine state
let engineRunning = false;
let lastCheckTime = "";
let currentPeriod = "";
let countdown = "";
let drawHistory: DrawResult[] = [];
let lastProcessedPeriod = "";
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let keepAliveHandle: ReturnType<typeof setInterval> | null = null;
let historyLoaded = false;

// Current mode and algorithm
let currentMode: "shuangzu" | "sanmen" = "shuangzu";
let currentShuangzuAlgo = "sz_hybrid";
let currentSanmenAlgo = "sm_hybrid";

// Sessions
let groupSessions: Map<string, SessionState> = new Map();

// Logs
let logs: LogEntry[] = [];

// Delay
let messageDelay = 0;

// Backtest cache
interface BacktestCache {
  shuangzu: BacktestResult[];
  sanmen: BacktestResult[];
  bestShuangzu: BacktestResult | null;
  bestSanmen: BacktestResult | null;
  timestamp: number;
}
let backtestCache: BacktestCache | null = null;

const POLL_INTERVAL_MS = 8000;

const GROUP_CONFIGS: GroupConfig[] = [
  { groupId: "-1004291735704", auditorUsername: "@pznbnb", groupName: "群组1" },
  { groupId: "-1004295253660", auditorUsername: "@hn222", groupName: "群组2" },
];

function addLog(action: string, details: string, groupId?: string) {
  logs.unshift({ time: new Date().toISOString(), action, details, groupId });
  if (logs.length > 200) logs = logs.slice(0, 200);
}

export interface EngineStatus {
  running: boolean;
  connected: boolean;
  lastCheck: string;
  currentPeriod: string;
  countdown: string;
  currentMode: "shuangzu" | "sanmen";
  currentAlgorithm: string;
  messageDelay: number;
  historySize: number;
  historyLoaded: boolean;
  sessions: SessionState[];
  logs: LogEntry[];
  backtest: BacktestCache | null;
  algorithms: {
    shuangzu: typeof SHUANGZU_ALGORITHMS;
    sanmen: typeof SANMEN_ALGORITHMS;
  };
}

export function getEngineStatus(): EngineStatus {
  return {
    running: engineRunning,
    connected: isClientConnected(),
    lastCheck: lastCheckTime,
    currentPeriod,
    countdown,
    currentMode,
    currentAlgorithm: currentMode === "shuangzu" ? currentShuangzuAlgo : currentSanmenAlgo,
    messageDelay,
    historySize: drawHistory.length,
    historyLoaded,
    sessions: Array.from(groupSessions.values()),
    logs: logs.slice(0, 50),
    backtest: backtestCache,
    algorithms: {
      shuangzu: SHUANGZU_ALGORITHMS,
      sanmen: SANMEN_ALGORITHMS,
    },
  };
}

export function setCurrentMode(mode: "shuangzu" | "sanmen") {
  if (mode !== currentMode) {
    currentMode = mode;
    addLog("MODE", `切换到${mode === "shuangzu" ? "双组" : "三门"}模式`);
    resetSessions();
  }
}

export function setAlgorithm(algorithmId: string) {
  if (algorithmId.startsWith("sz_")) {
    currentShuangzuAlgo = algorithmId;
    addLog("ALGO", `双组算法: ${algorithmId}`);
  } else if (algorithmId.startsWith("sm_")) {
    currentSanmenAlgo = algorithmId;
    addLog("ALGO", `三门算法: ${algorithmId}`);
  }
  resetSessions();
}

export function setMessageDelay(seconds: number) {
  messageDelay = Math.max(0, Math.min(120, seconds));
  addLog("CONFIG", `延迟: ${messageDelay}秒`);
}

export function getDrawHistory() {
  return [...drawHistory];
}

/**
 * Load historical data on startup
 */
export async function loadHistoricalData(): Promise<number> {
  addLog("DATA", "正在加载历史数据...");
  const { draws, error } = await fetchHistoricalDraws(100);

  if (error) {
    addLog("ERROR", `加载历史数据失败: ${error}`);
    return 0;
  }

  drawHistory = mergeIntoHistory(drawHistory, draws);
  historyLoaded = true;
  addLog("DATA", `已加载 ${drawHistory.length} 期历史数据`);

  // Auto run backtest
  runBacktest();

  return drawHistory.length;
}

/**
 * Run backtest for all algorithms
 */
export function runBacktest() {
  if (drawHistory.length < 15) {
    addLog("BACKTEST", `数据不足(${drawHistory.length}期)`);
    return null;
  }

  addLog("BACKTEST", `回测中...`);
  const results = backtestAllAlgorithms(drawHistory);
  backtestCache = { ...results, timestamp: Date.now() };

  if (results.bestShuangzu) {
    addLog("BACKTEST", `最佳双组: ${results.bestShuangzu.algorithmName} (${(results.bestShuangzu.accuracy * 100).toFixed(1)}%)`);
  }
  if (results.bestSanmen) {
    addLog("BACKTEST", `最佳三门: ${results.bestSanmen.algorithmName} (${(results.bestSanmen.accuracy * 100).toFixed(1)}%)`);
  }

  return backtestCache;
}

function formatMessage(session: SessionState): string {
  const typeLabel = session.sessionType === "shuangzu" ? "📊 双组" : "🎯 三门";
  let msg = `${typeLabel}\n`;

  for (const p of session.predictions) {
    const short = getPeriodShort(p.period);
    let line = `${short}.${p.prediction}`;
    if (p.isCorrect === true) line += " ✅";
    else if (p.isCorrect === false) line += " ❌";
    msg += line + "\n";
  }

  const total = session.correctCount + session.wrongCount;
  if (total > 0) {
    const rate = ((session.correctCount / total) * 100).toFixed(0);
    msg += `\n📈 ${session.correctCount}中${session.wrongCount}挂 胜率${rate}%`;
  }

  return msg;
}

function checkShuangzuReward(session: SessionState): string | null {
  if (session.maxConsecutiveCorrect >= SHUANGZU_RULES.consecutiveCorrectForReward) {
    return `连中${session.maxConsecutiveCorrect}期`;
  }
  if (session.maxConsecutiveWrong >= SHUANGZU_RULES.consecutiveWrongForReward) {
    return `连挂${session.maxConsecutiveWrong}期`;
  }
  const total = session.correctCount + session.wrongCount;
  if (total >= SHUANGZU_RULES.winRatePeriodMin && total <= SHUANGZU_RULES.winRatePeriodMax) {
    const winRate = session.correctCount / total;
    if (winRate >= 0.9) return `胜率${(winRate * 100).toFixed(0)}%`;
    if (winRate >= 0.8) return `胜率${(winRate * 100).toFixed(0)}%`;
  }
  return null;
}

function checkSanmenReward(session: SessionState): string | null {
  if (session.maxConsecutiveCorrect >= SANMEN_RULES.consecutiveCorrectForReward) {
    return `连中${session.maxConsecutiveCorrect}期`;
  }
  return null;
}

function createSession(groupId: string, startPeriod: string): SessionState {
  return {
    id: Date.now() + Math.random(),
    groupId,
    sessionType: currentMode,
    status: "active",
    startPeriod,
    currentPeriod: startPeriod,
    predictions: [],
    totalPredictions: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    maxConsecutiveCorrect: 0,
    maxConsecutiveWrong: 0,
    rewardClaimed: false,
  };
}

function addPrediction(session: SessionState, nextPeriod: string): PredictionEntry {
  const algoId = session.sessionType === "shuangzu" ? currentShuangzuAlgo : currentSanmenAlgo;
  let prediction: string;

  if (session.sessionType === "shuangzu") {
    prediction = predictShuangzuWithAlgorithm(algoId, drawHistory, nextPeriod).prediction;
  } else {
    prediction = predictSanmenWithAlgorithm(algoId, drawHistory, nextPeriod).prediction;
  }

  const entry: PredictionEntry = { period: nextPeriod, prediction };
  session.predictions.push(entry);
  session.totalPredictions++;
  session.currentPeriod = nextPeriod;

  return entry;
}

function verifyPrediction(session: SessionState, draw: DrawResult): boolean | null {
  const pred = session.predictions.find((p) => p.period === draw.period && p.isCorrect === undefined);
  if (!pred) return null;

  pred.actualResult = draw.combination;
  pred.isCorrect = session.sessionType === "shuangzu"
    ? checkShuangzu(pred.prediction, draw.combination)
    : checkSanmen(pred.prediction, draw.combination);

  if (pred.isCorrect) {
    session.correctCount++;
    session.consecutiveCorrect++;
    session.consecutiveWrong = 0;
    if (session.consecutiveCorrect > session.maxConsecutiveCorrect) {
      session.maxConsecutiveCorrect = session.consecutiveCorrect;
    }
  } else {
    session.wrongCount++;
    session.consecutiveWrong++;
    session.consecutiveCorrect = 0;
    if (session.consecutiveWrong > session.maxConsecutiveWrong) {
      session.maxConsecutiveWrong = session.consecutiveWrong;
    }
  }

  return pred.isCorrect;
}

async function sendRewardNotification(session: SessionState, rewardType: string) {
  const group = GROUP_CONFIGS.find((g) => g.groupId === session.groupId);
  if (!group) return;

  const typeLabel = session.sessionType === "shuangzu" ? "双组" : "三门";
  const link = session.messageLink || "(无链接)";

  const text = `🎁 报数奖励\n类型: ${typeLabel}\n群组: ${group.groupName}\n奖励: ${rewardType}\n链接: ${link}`;

  const result = await sendPrivateMessage(group.auditorUsername, text);
  if (result.ok) {
    session.rewardClaimed = true;
    session.rewardType = rewardType;
    addLog("REWARD", `已私聊 ${group.auditorUsername}`, group.groupId);
  } else {
    addLog("ERROR", `发送失败: ${result.error}`, group.groupId);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNewDraw(draw: DrawResult) {
  const nextPeriod = getNextPeriod(draw.period);

  if (messageDelay > 0) {
    await delay(messageDelay * 1000);
  }

  for (const group of GROUP_CONFIGS) {
    let session = groupSessions.get(group.groupId);

    if (!session || session.status !== "active") {
      session = createSession(group.groupId, draw.period);
      groupSessions.set(group.groupId, session);
      addLog("SESSION", `新建${currentMode}会话`, group.groupId);

      addPrediction(session, nextPeriod);

      const msg = formatMessage(session);
      const result = await sendMessage(group.groupId, msg);
      if (result.ok && result.messageId) {
        session.messageId = result.messageId;
        session.messageLink = getMessageLink(group.groupId, result.messageId);
        addLog("MSG", `已发送 ID:${result.messageId}`, group.groupId);
      }
      continue;
    }

    const verified = verifyPrediction(session, draw);
    if (verified !== null) {
      addLog("VERIFY", `${draw.period.slice(-4)}: ${verified ? "✅" : "❌"}`, group.groupId);
    }

    // Handle sanmen reset on wrong
    if (session.sessionType === "sanmen" && verified === false) {
      session.status = "stopped";
      addLog("RESET", "三门挂了，重新开始", group.groupId);

      const newSession = createSession(group.groupId, draw.period);
      groupSessions.set(group.groupId, newSession);
      addPrediction(newSession, nextPeriod);

      const msg = formatMessage(newSession);
      const result = await sendMessage(group.groupId, msg);
      if (result.ok && result.messageId) {
        newSession.messageId = result.messageId;
        newSession.messageLink = getMessageLink(group.groupId, result.messageId);
      }
      continue;
    }

    // Check completion
    const total = session.correctCount + session.wrongCount;
    const reward = session.sessionType === "shuangzu"
      ? checkShuangzuReward(session)
      : checkSanmenReward(session);

    // Shuangzu: stop at 11 if no reward possible
    if (session.sessionType === "shuangzu" && total >= 11 && !reward) {
      session.status = "stopped";
      addLog("RESET", "双组无奖励，重新开始", group.groupId);

      const newSession = createSession(group.groupId, draw.period);
      groupSessions.set(group.groupId, newSession);
      addPrediction(newSession, nextPeriod);

      const msg = formatMessage(newSession);
      const result = await sendMessage(group.groupId, msg);
      if (result.ok && result.messageId) {
        newSession.messageId = result.messageId;
        newSession.messageLink = getMessageLink(group.groupId, result.messageId);
      }
      continue;
    }

    // Complete if reward achieved or max reached
    const maxReached = total >= (session.sessionType === "shuangzu" ? SHUANGZU_RULES.maxPredictions : SANMEN_RULES.maxPredictions);
    const sanmenGoal = session.sessionType === "sanmen" && session.consecutiveCorrect >= SANMEN_RULES.consecutiveCorrectForReward;

    if ((reward && total >= 10) || maxReached || sanmenGoal) {
      session.status = "completed";
      if (session.messageId) {
        await editMessage(group.groupId, session.messageId, formatMessage(session));
      }
      if (reward) {
        await sendRewardNotification(session, reward);
      }
      addLog("COMPLETE", `${session.sessionType} 完成`, group.groupId);
      continue;
    }

    // Continue session
    addPrediction(session, nextPeriod);
    if (session.messageId) {
      await editMessage(group.groupId, session.messageId, formatMessage(session));
    }
  }
}

async function pollLoop() {
  try {
    const { draw, countdown: cd, error } = await fetchLatestDraw();
    lastCheckTime = new Date().toISOString();
    countdown = cd;

    if (error) {
      addLog("ERROR", error);
      return;
    }

    if (!draw) return;

    // Update history
    drawHistory = mergeIntoHistory(drawHistory, [draw]);
    currentPeriod = draw.period;

    if (draw.period !== lastProcessedPeriod) {
      lastProcessedPeriod = draw.period;
      addLog("DRAW", `${draw.period.slice(-4)}: ${draw.num}(${draw.combination})`);

      if (isClientConnected()) {
        await processNewDraw(draw);
      }
    }
  } catch (err) {
    addLog("ERROR", err instanceof Error ? err.message : "未知错误");
  }
}

export async function startEngine() {
  if (engineRunning) return;
  engineRunning = true;
  addLog("ENGINE", "引擎启动");

  // Try auto-reconnect Telegram from DB session
  if (!isClientConnected()) {
    addLog("ENGINE", "尝试自动恢复 Telegram 连接...");
    const ok = await autoReconnect();
    addLog("ENGINE", ok ? "Telegram 自动连接成功 ✓" : "Telegram 未恢复（需手动登录）");
  }

  if (!historyLoaded) {
    loadHistoricalData();
  }

  pollLoop();
  intervalHandle = setInterval(pollLoop, POLL_INTERVAL_MS);

  // Self-ping every 4 min to keep Render free-tier alive
  if (!keepAliveHandle) {
    keepAliveHandle = setInterval(async () => {
      try {
        const base = process.env.RENDER_EXTERNAL_URL || process.env.NEXT_PUBLIC_URL || "";
        if (base) await fetch(`${base}/api/keepalive`);
      } catch {}
    }, 4 * 60 * 1000);
  }
}

export function stopEngine() {
  if (!engineRunning) return;
  engineRunning = false;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  addLog("ENGINE", "引擎停止");
}

export function resetSessions() {
  groupSessions.clear();
  lastProcessedPeriod = "";
  addLog("ENGINE", "会话已重置");
}

export async function manualPoll() {
  await pollLoop();
}

export function clearHistory() {
  drawHistory = [];
  backtestCache = null;
  historyLoaded = false;
  addLog("ENGINE", "数据已清空");
}
