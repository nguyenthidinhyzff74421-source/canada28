/**
 * Persist config (Telegram session, API keys, settings) to PostgreSQL
 * So that Render restarts don't lose login state
 */

import { db } from "@/db";
import { config } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function saveConfig(key: string, value: string): Promise<void> {
  try {
    const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(config).set({ value, updatedAt: new Date() }).where(eq(config.key, key));
    } else {
      await db.insert(config).values({ key, value });
    }
  } catch (e) {
    console.error(`[DB] Failed to save config "${key}":`, e);
  }
}

export async function loadConfig(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return rows.length > 0 ? rows[0].value : null;
  } catch (e) {
    console.error(`[DB] Failed to load config "${key}":`, e);
    return null;
  }
}

export async function deleteConfig(key: string): Promise<void> {
  try {
    await db.delete(config).where(eq(config.key, key));
  } catch (e) {
    console.error(`[DB] Failed to delete config "${key}":`, e);
  }
}
