#!/usr/bin/env node

import { initConfig, getConfig, getConfigPath } from "../src/services/configStore.mjs";

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  secure-deployer — Local management client for Secure Deployer

  Usage:
    secure-deployer [options]

  Options:
    --port <port>   Override the dashboard port (default: 9877)
    -h, --help      Show this help message
  `);
  process.exit(0);
}

initConfig();

const portOverride = getFlag("port");
const config = getConfig();
const port = portOverride ? parseInt(portOverride) : config.dashPort;

const { createServer } = await import("../src/server.mjs");
const app = createServer();

app.listen(port, "127.0.0.1", () => {
  console.log("");
  console.log("=".repeat(50));
  console.log("  Secure Deployer — Management Client");
  console.log("=".repeat(50));
  console.log(`  Dashboard:  http://localhost:${port}`);
  console.log(`  Servers:    ${config.servers.length} configured`);
  console.log(`  Config:     ${getConfigPath()}`);
  console.log("=".repeat(50));
  console.log("");
});
