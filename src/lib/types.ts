export interface GroupConfig {
  groupId: string;
  auditorUsername: string; // e.g. "@pznbnb"
  groupName: string;
}

export interface BotConfig {
  botToken: string;
  groups: GroupConfig[];
}

export interface SessionState {
  id: number;
  groupId: string;
  sessionType: "shuangzu" | "sanmen";
  status: "active" | "completed" | "stopped" | "reward_sent";
  startPeriod: string;
  currentPeriod: string;
  predictions: PredictionEntry[];
  totalPredictions: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  maxConsecutiveCorrect: number;
  maxConsecutiveWrong: number;
  messageId?: number;
  messageLink?: string;
  rewardClaimed: boolean;
  rewardType?: string;
}

export interface PredictionEntry {
  period: string;
  prediction: string;
  actualResult?: string;
  actualNum?: number;
  isCorrect?: boolean;
}

export interface EngineStatus {
  running: boolean;
  lastCheck: string;
  currentPeriod: string;
  countdown: string;
  sessions: SessionState[];
  logs: LogEntry[];
}

export interface LogEntry {
  time: string;
  action: string;
  details: string;
  groupId?: string;
}

// Reward rules
export const SHUANGZU_RULES = {
  minPredictions: 10,
  maxPredictions: 15,
  consecutiveCorrectForReward: 6,
  consecutiveWrongForReward: 6,
  winRateThresholds: [0.8, 0.9] as number[],
  winRatePeriodMin: 10,
  winRatePeriodMax: 15,
};

export const SANMEN_RULES = {
  minPredictions: 10,
  maxPredictions: 15,
  consecutiveCorrectForReward: 10,
};
