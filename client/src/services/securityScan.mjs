import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import * as proxy from "./agentProxy.mjs";

const DATA_DIR = join(homedir(), ".secure-deployer");
const SCANS_DIR = join(DATA_DIR, "scans");
const MAX_TIMEOUT = 5 * 60_000;

function ensureDir() { mkdirSync(SCANS_DIR, { recursive: true }); }

function scanPath(serverId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(serverId)) throw new Error("Invalid serverId");
  return join(SCANS_DIR, `${serverId}.json`);
}

export function getLatestScan(serverId) {
  ensureDir();
  const p = scanPath(serverId);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function saveScan(serverId, scan) {
  ensureDir();
  writeFileSync(scanPath(serverId), JSON.stringify(scan, null, 2), "utf-8");
  return scan;
}

const RUNNING = new Map();

export function isScanRunning(serverId) { return RUNNING.has(serverId); }

export function getRunningScan(serverId) { return RUNNING.get(serverId) || null; }

async function agentExec(serverId, cmd, description, timeout = 60_000) {
  const submitted = await proxy.execCommand(serverId, { cmd, description, timeout });
  if (submitted.status === "completed") return submitted.result || {};

  const deadline = Date.now() + timeout + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const resp = await proxy.getTask(serverId, submitted.taskId);
    const task = resp.task || resp;
    if (task.status === "completed") return task.result || {};
    if (task.status === "failed") return { exitCode: task.result?.exitCode ?? 1, stdout: task.result?.stdout || "", stderr: task.result?.stderr || task.result?.error || "" };
    if (task.status === "rejected") throw new Error("Task rejected by user (approval required). Switch execution mode or enable auto-approve for the scan.");
    if (task.status === "blocked") throw new Error("Command blocked by security policy.");
  }
  throw new Error("Scan command timed out while waiting for agent result.");
}

function parseLynisReport(reportText) {
  const warnings = [];
  const suggestions = [];
  const testsDone = [];
  let hardeningIndex = null;

  const lines = reportText.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();

    if (key === "warning[]") {
      const parts = val.split("|");
      warnings.push({ id: parts[0] || "", text: parts[1] || val, solution: parts[2] || "", url: parts[3] || "" });
    } else if (key === "suggestion[]") {
      const parts = val.split("|");
      suggestions.push({ id: parts[0] || "", text: parts[1] || val, solution: parts[2] || "", url: parts[3] || "" });
    } else if (key === "hardening_index") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) hardeningIndex = n;
    } else if (key === "tests_executed") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) testsDone.push(n);
    }
  }
  return { warnings, suggestions, hardeningIndex, testsExecuted: testsDone[0] || 0 };
}

export async function runScan(serverId, { onProgress } = {}) {
  if (RUNNING.has(serverId)) throw new Error("A scan is already in progress for this server.");

  const scanId = randomBytes(6).toString("hex");
  const state = { scanId, serverId, status: "running", step: "starting", startedAt: Date.now(), progress: 0 };
  RUNNING.set(serverId, state);
  const update = (patch) => {
    Object.assign(state, patch);
    onProgress?.({ ...state });
  };

  try {
    update({ step: "checking_lynis", progress: 5 });
    const checkRes = await agentExec(
      serverId,
      "command -v lynis >/dev/null 2>&1 && lynis --version 2>/dev/null | head -1 || echo NOTFOUND",
      "Check if Lynis is installed on the server (security scan module).",
      15_000
    );
    const lynisInstalled = !(checkRes.stdout || "").includes("NOTFOUND");

    if (!lynisInstalled) {
      update({ step: "installing_lynis", progress: 15 });
      const installCmd = "(command -v apt-get >/dev/null && sudo -n DEBIAN_FRONTEND=noninteractive apt-get update -y && sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y lynis) || (command -v yum >/dev/null && sudo -n yum install -y lynis) || (command -v dnf >/dev/null && sudo -n dnf install -y lynis) || echo INSTALL_FAILED";
      const install = await agentExec(serverId, installCmd, "Install Lynis (security auditing tool) via the system package manager.", 180_000);
      const out = (install.stdout || "") + (install.stderr || "");
      if (out.includes("INSTALL_FAILED") || (install.exitCode && install.exitCode !== 0)) {
        throw new Error("Failed to install Lynis automatically. Please install it manually (e.g. `sudo apt install lynis`) and try again.");
      }
    }

    update({ step: "running_audit", progress: 30 });
    const auditCmd = "sudo -n lynis audit system --quick --no-colors --quiet 2>&1 | tail -c 65536 ; echo '---REPORT---' ; sudo -n cat /var/log/lynis-report.dat 2>/dev/null || cat /var/log/lynis-report.dat 2>/dev/null || echo NOREPORT";
    const audit = await agentExec(serverId, auditCmd, "Run Lynis security audit and collect the report.", MAX_TIMEOUT);

    update({ step: "parsing", progress: 85 });
    const out = audit.stdout || "";
    const splitIdx = out.indexOf("---REPORT---");
    const reportText = splitIdx >= 0 ? out.slice(splitIdx + "---REPORT---".length) : "";
    if (!reportText || reportText.includes("NOREPORT")) {
      throw new Error("Lynis audit completed but the report file could not be read. The user may need sudo permissions to read /var/log/lynis-report.dat.");
    }
    const parsed = parseLynisReport(reportText);

    const scan = {
      scanId,
      serverId,
      startedAt: state.startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - state.startedAt,
      tool: "lynis",
      status: "completed",
      hardeningIndex: parsed.hardeningIndex,
      testsExecuted: parsed.testsExecuted,
      warnings: parsed.warnings,
      suggestions: parsed.suggestions,
      rawLog: (audit.stdout || "").slice(0, splitIdx > 0 ? splitIdx : 5000),
    };
    saveScan(serverId, scan);
    update({ status: "completed", progress: 100, finishedAt: scan.finishedAt });
    return scan;
  } catch (err) {
    const failed = {
      scanId,
      serverId,
      startedAt: state.startedAt,
      finishedAt: Date.now(),
      tool: "lynis",
      status: "failed",
      error: err.message || String(err),
    };
    saveScan(serverId, failed);
    update({ status: "failed", progress: 100, error: failed.error, finishedAt: failed.finishedAt });
    return failed;
  } finally {
    setTimeout(() => RUNNING.delete(serverId), 500);
  }
}
