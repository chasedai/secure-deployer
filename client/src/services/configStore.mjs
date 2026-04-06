import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes, createHash } from "node:crypto";

const DATA_DIR = join(homedir(), ".secure-deployer");
const CLIENT_CONFIG_PATH = join(DATA_DIR, "client-config.json");

const DEFAULT_CONFIG = {
  dashPort: 9877,
  dashPasswordHash: "",
  servers: [],
};

let _config = null;

export function getConfigPath() {
  return CLIENT_CONFIG_PATH;
}

export function initConfig() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (existsSync(CLIENT_CONFIG_PATH)) {
    const stored = JSON.parse(readFileSync(CLIENT_CONFIG_PATH, "utf-8"));
    _config = { ...DEFAULT_CONFIG, ...stored };
  } else {
    _config = { ...DEFAULT_CONFIG };
    saveConfig();
  }
  return _config;
}

export function getConfig() {
  if (!_config) throw new Error("Config not initialized.");
  return _config;
}

export function updateConfig(patch) {
  _config = { ...getConfig(), ...patch };
  saveConfig();
  return _config;
}

function saveConfig() {
  writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify(_config, null, 2), "utf-8");
}

export function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function addServer({ name, host, port, apiKey, managementSecret, projects }) {
  const config = getConfig();
  const id = randomBytes(8).toString("hex");
  const server = {
    id,
    name: name || `server-${config.servers.length + 1}`,
    host,
    port: port || 9876,
    apiKey: apiKey || "",
    managementSecret,
    projects: projects || [],
    createdAt: Date.now(),
  };
  config.servers.push(server);
  saveConfig();
  return server;
}

export function updateServer(id, patch) {
  const config = getConfig();
  const idx = config.servers.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  config.servers[idx] = { ...config.servers[idx], ...patch };
  saveConfig();
  return config.servers[idx];
}

export function removeServer(id) {
  const config = getConfig();
  const idx = config.servers.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  config.servers.splice(idx, 1);
  saveConfig();
  return true;
}

export function getServers() {
  return getConfig().servers;
}

export function getServer(id) {
  return getConfig().servers.find((s) => s.id === id) || null;
}
