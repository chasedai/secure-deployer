import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { generateApiKey, generateManagementSecret } from "./security.mjs";

const DATA_DIR = join(homedir(), ".secure-deployer");
const CONFIG_PATH = join(DATA_DIR, "config.json");
const HISTORY_PATH = join(DATA_DIR, "history.json");

const DEFAULT_CONFIG = {
  apiPort: 9876,
  apiKey: "",
  managementSecret: "",
  executionMode: "approval",
  defaultCwd: homedir(),
  maxTimeout: 300_000,
  rateLimit: { windowMs: 60_000, max: 60 },
  commandBlacklist: [
    "rm -rf /",
    "rm -rf /*",
    "mkfs",
    "dd if=",
    "> /dev/sda",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "init 0",
    "init 6",
  ],
  maxUploadSize: 50 * 1024 * 1024,
};

let _config = null;

export function getConfigPath() {
  return CONFIG_PATH;
}

export function getDataDir() {
  return DATA_DIR;
}

export function getHistoryPath() {
  return HISTORY_PATH;
}

export function initConfig() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (existsSync(CONFIG_PATH)) {
    const stored = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    _config = { ...DEFAULT_CONFIG, ...stored };
    let migrated = false;
    if (!_config.managementSecret) {
      _config.managementSecret = generateManagementSecret();
      migrated = true;
    }
    if (!_config.apiKey) {
      _config.apiKey = generateApiKey();
      migrated = true;
    }
    if (migrated) saveConfig();
  } else {
    _config = {
      ...DEFAULT_CONFIG,
      apiKey: generateApiKey(),
      managementSecret: generateManagementSecret(),
    };
    saveConfig();
  }
  return _config;
}

export function getConfig() {
  if (!_config) throw new Error("Config not initialized. Call initConfig() first.");
  return _config;
}

export function updateConfig(patch) {
  _config = { ...getConfig(), ...patch };
  saveConfig();
  return _config;
}

function saveConfig() {
  writeFileSync(CONFIG_PATH, JSON.stringify(_config, null, 2), "utf-8");
}
