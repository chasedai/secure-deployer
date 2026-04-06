#!/usr/bin/env node

import { existsSync } from "node:fs";
import { getConfigPath, initConfig, getConfig, updateConfig } from "../src/utils/config.mjs";
import { generateApiKey, generateManagementSecret } from "../src/utils/security.mjs";

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) || "start";

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

if (command === "help" || args.includes("--help") || args.includes("-h")) {
  console.log(`
  secure-deployer-agent — Lightweight remote agent for Secure Deployer

  Usage:
    secure-deployer-agent [command] [options]

  Commands:
    start               Start the agent server (default)
    credentials         Display current API Key and Management Secret
    rotate-keys         Generate new API Key and Management Secret

  Options:
    --port <port>              Override the listening port (default: 9876)
    --api-key <key>            Set a custom API Key
    --manage-secret <secret>   Set a custom Management Secret
    -h, --help                 Show this help message
  `);
  process.exit(0);
}

const firstRun = !existsSync(getConfigPath());
initConfig();

if (command === "credentials") {
  const cfg = getConfig();
  console.log(`\n  API Key:            ${cfg.apiKey}`);
  console.log(`  Management Secret:  ${cfg.managementSecret}`);
  console.log(`  Port:               ${cfg.apiPort}`);
  console.log(`  Config:             ${getConfigPath()}\n`);
  process.exit(0);
}

if (command === "rotate-keys") {
  updateConfig({
    apiKey: generateApiKey(),
    managementSecret: generateManagementSecret(),
  });
  const cfg = getConfig();
  console.log("\n  Keys rotated successfully!\n");
  console.log(`  API Key:            ${cfg.apiKey}`);
  console.log(`  Management Secret:  ${cfg.managementSecret}\n`);
  process.exit(0);
}

// --- start command ---

const portOverride = getFlag("port");
const apiKeyOverride = getFlag("api-key");
const secretOverride = getFlag("manage-secret");

if (portOverride) updateConfig({ apiPort: parseInt(portOverride) });
if (apiKeyOverride) updateConfig({ apiKey: apiKeyOverride });
if (secretOverride) updateConfig({ managementSecret: secretOverride });

const { initHistory } = await import("../src/services/history.mjs");
const { createServer } = await import("../src/server.mjs");

initHistory();

const config = getConfig();
const app = createServer();

app.listen(config.apiPort, "0.0.0.0", () => {
  const w = 56;
  console.log("");
  console.log("=".repeat(w));
  console.log("  Secure Deployer Agent v1.0.0");
  console.log("=".repeat(w));
  console.log(`  Port:               ${config.apiPort}`);
  console.log(`  Mode:               ${config.executionMode === "approval" ? "Approval (commands need approval)" : "Auto-execute"}`);
  console.log("-".repeat(w));
  if (firstRun) {
    console.log("  ★ First run — save these credentials!");
    console.log("-".repeat(w));
  }
  console.log(`  API Key:            ${config.apiKey}`);
  console.log(`  Management Secret:  ${config.managementSecret}`);
  console.log("-".repeat(w));
  console.log(`  AI API:             http://0.0.0.0:${config.apiPort}/api/*`);
  console.log(`  Management API:     http://0.0.0.0:${config.apiPort}/manage/*`);
  console.log(`  Config:             ${getConfigPath()}`);
  console.log("=".repeat(w));
  if (firstRun) {
    console.log("");
    console.log("  Copy the API Key and Management Secret to your");
    console.log("  local Secure Deployer client to connect.");
  }
  console.log("");
});
