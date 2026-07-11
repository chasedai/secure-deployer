import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

const DATA_DIR = join(homedir(), ".secure-deployer");
const CHATS_DIR = join(DATA_DIR, "chats");

const MAX_MESSAGES = 200;
const MAX_CONTEXT_MESSAGES = 40;

function ensureDir() {
  mkdirSync(CHATS_DIR, { recursive: true });
}

function chatPath(serverId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(serverId)) throw new Error("Invalid serverId");
  return join(CHATS_DIR, `${serverId}.json`);
}

function emptyChat() {
  return { messages: [], autoApprove: false, updatedAt: Date.now() };
}

export function getChat(serverId) {
  ensureDir();
  const p = chatPath(serverId);
  if (!existsSync(p)) return emptyChat();
  try {
    const data = JSON.parse(readFileSync(p, "utf-8"));
    return {
      messages: Array.isArray(data.messages) ? data.messages : [],
      autoApprove: Boolean(data.autoApprove),
      updatedAt: data.updatedAt || Date.now(),
    };
  } catch {
    return emptyChat();
  }
}

export function saveChat(serverId, chat) {
  ensureDir();
  const p = chatPath(serverId);
  const data = { ...chat, updatedAt: Date.now() };
  if (data.messages.length > MAX_MESSAGES) {
    data.messages = data.messages.slice(-MAX_MESSAGES);
  }
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  return data;
}

export function appendMessage(serverId, message) {
  const chat = getChat(serverId);
  const withId = { id: randomBytes(6).toString("hex"), timestamp: Date.now(), ...message };
  chat.messages.push(withId);
  return { chat: saveChat(serverId, chat), message: withId };
}

export function updateMessage(serverId, messageId, patch) {
  const chat = getChat(serverId);
  const idx = chat.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  chat.messages[idx] = { ...chat.messages[idx], ...patch };
  saveChat(serverId, chat);
  return chat.messages[idx];
}

export function setAutoApprove(serverId, enabled) {
  const chat = getChat(serverId);
  chat.autoApprove = Boolean(enabled);
  return saveChat(serverId, chat);
}

export function clearChat(serverId) {
  ensureDir();
  const p = chatPath(serverId);
  if (existsSync(p)) unlinkSync(p);
  return emptyChat();
}

export function getChatContext(serverId, limit = MAX_CONTEXT_MESSAGES) {
  const { messages } = getChat(serverId);
  return messages.slice(-limit);
}

export function listChats() {
  ensureDir();
  const files = readdirSync(CHATS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => f.replace(/\.json$/, ""));
}
