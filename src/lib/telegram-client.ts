/**
 * Telegram MTProto Client - with DB persistence
 * Survives Render restarts without needing re-login
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { saveConfig, loadConfig, deleteConfig } from "./db-config";

let client: TelegramClient | null = null;
let sessionString = "";
let isConnected = false;

let tgConfig = {
  apiId: 0,
  apiHash: "",
  phoneNumber: "",
};

// ===== Config =====

export function setTelegramConfig(apiId: number, apiHash: string, phoneNumber: string) {
  tgConfig = { apiId, apiHash, phoneNumber };
}

export function getTelegramConfig() {
  return { ...tgConfig, apiHash: tgConfig.apiHash ? "****" + tgConfig.apiHash.slice(-4) : "" };
}

export function setSessionString(session: string) {
  sessionString = session;
}

export function getSessionString(): string {
  return sessionString;
}

export function isClientConnected(): boolean {
  return isConnected && client !== null;
}

// ===== Persist to DB =====

export async function saveAllToDb() {
  await saveConfig("tg_api_id", String(tgConfig.apiId));
  await saveConfig("tg_api_hash", tgConfig.apiHash);
  await saveConfig("tg_phone", tgConfig.phoneNumber);
  if (sessionString) {
    await saveConfig("tg_session", sessionString);
  }
}

export async function loadAllFromDb(): Promise<boolean> {
  const apiId = await loadConfig("tg_api_id");
  const apiHash = await loadConfig("tg_api_hash");
  const phone = await loadConfig("tg_phone");
  const session = await loadConfig("tg_session");

  if (apiId && apiHash) {
    tgConfig = {
      apiId: parseInt(apiId, 10),
      apiHash,
      phoneNumber: phone || "",
    };
    if (session) {
      sessionString = session;
    }
    return true;
  }
  return false;
}

// ===== Connect / Auth =====

export async function connectClient(): Promise<{ ok: boolean; needCode?: boolean; error?: string }> {
  if (!tgConfig.apiId || !tgConfig.apiHash) {
    return { ok: false, error: "API ID and API Hash not configured" };
  }

  try {
    const stringSession = new StringSession(sessionString);
    client = new TelegramClient(stringSession, tgConfig.apiId, tgConfig.apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const authorized = await client.isUserAuthorized();
    if (authorized) {
      isConnected = true;
      sessionString = client.session.save() as unknown as string;
      await saveConfig("tg_session", sessionString);
      return { ok: true };
    }

    if (!tgConfig.phoneNumber) {
      return { ok: false, error: "Phone number not configured" };
    }

    await client.sendCode(
      { apiId: tgConfig.apiId, apiHash: tgConfig.apiHash },
      tgConfig.phoneNumber
    );

    return { ok: false, needCode: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function submitCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return { ok: false, error: "Client not initialized" };
  }

  try {
    await client.signInUser(
      { apiId: tgConfig.apiId, apiHash: tgConfig.apiHash },
      {
        phoneNumber: tgConfig.phoneNumber,
        phoneCode: async () => code,
        onError: (err) => { throw err; },
      }
    );

    isConnected = true;
    sessionString = client.session.save() as unknown as string;
    // Persist session to DB — this is the key line
    await saveAllToDb();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function disconnectClient() {
  if (client) {
    await client.disconnect();
    client = null;
    isConnected = false;
  }
}

// ===== Auto-reconnect on startup =====

export async function autoReconnect(): Promise<boolean> {
  const loaded = await loadAllFromDb();
  if (!loaded || !sessionString) return false;

  const result = await connectClient();
  return result.ok === true;
}

// ===== Messaging =====

export async function sendMessage(
  chatId: string,
  text: string
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!client || !isConnected) {
    return { ok: false, error: "Client not connected" };
  }

  try {
    const result = await client.sendMessage(chatId, { message: text });
    return { ok: true, messageId: result.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function editMessage(
  chatId: string,
  messageId: number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !isConnected) {
    return { ok: false, error: "Client not connected" };
  }

  try {
    await client.editMessage(chatId, { message: messageId, text });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function sendPrivateMessage(
  username: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !isConnected) {
    return { ok: false, error: "Client not connected" };
  }

  try {
    const cleanUsername = username.startsWith("@") ? username.slice(1) : username;
    await client.sendMessage(cleanUsername, { message: text });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export function getMessageLink(groupId: string, messageId: number): string {
  const cleanId = groupId.replace("-100", "");
  return `https://t.me/c/${cleanId}/${messageId}`;
}
