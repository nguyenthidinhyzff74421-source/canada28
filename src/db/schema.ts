import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Store lottery draw results
export const draws = pgTable("draws", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull().unique(),
  date: varchar("date", { length: 20 }),
  time: varchar("time", { length: 20 }),
  numberDetail: varchar("number_detail", { length: 20 }),
  num: integer("num").notNull(),
  combination: varchar("combination", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Store prediction sessions
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull(),
  sessionType: varchar("session_type", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  startPeriod: varchar("start_period", { length: 20 }).notNull(),
  currentPeriod: varchar("current_period", { length: 20 }),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  wrongCount: integer("wrong_count").notNull().default(0),
  consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
  consecutiveWrong: integer("consecutive_wrong").notNull().default(0),
  maxConsecutiveCorrect: integer("max_consecutive_correct").notNull().default(0),
  maxConsecutiveWrong: integer("max_consecutive_wrong").notNull().default(0),
  messageId: integer("message_id"),
  messageLink: text("message_link"),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  rewardType: varchar("reward_type", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store individual predictions
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  prediction: varchar("prediction", { length: 20 }).notNull(),
  actualResult: varchar("actual_result", { length: 10 }),
  isCorrect: boolean("is_correct"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Store system configuration
export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store action logs
export const actionLogs = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  groupId: text("group_id"),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
