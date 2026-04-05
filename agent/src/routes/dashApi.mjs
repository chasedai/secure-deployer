import { Router } from "express";
import { cpus, totalmem, freemem, uptime as osUptime, hostname, platform, release, arch } from "node:os";
import { execSync } from "node:child_process";
import { getConfig, updateConfig } from "../utils/config.mjs";
import { hashPassword, verifyPassword, generateApiKey } from "../utils/security.mjs";
import { createSession, isPasswordSet } from "../middleware/dashAuth.mjs";
import { getPendingTasks, getAllTasks, approveTask, rejectTask, taskEvents } from "../services/taskQueue.mjs";
import { getHistory, getStats, addHistoryEntry } from "../services/history.mjs";
import { generateSkillDocument } from "../services/skillGen.mjs";
import { executeCommandStream } from "../services/executor.mjs";
import { getAlerts, getUnreadCount, markAlertsRead } from "../services/alertStore.mjs";

const router = Router();

router.get("/auth/check", (_req, res) => {
  res.json({ passwordSet: isPasswordSet() });
});

router.post("/auth/setup", (req, res) => {
  if (isPasswordSet()) {
    return res.status(400).json({ error: "Password already set. Use settings to change." });
  }
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  updateConfig({ dashPasswordHash: hashPassword(password) });
  const token = createSession();
  res.setHeader("Set-Cookie", `sd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.json({ ok: true });
});

router.post("/auth/login", (req, res) => {
  const { password } = req.body;
  const config = getConfig();
  if (!config.dashPasswordHash) {
    return res.status(400).json({ error: "Password not set yet. Use /dash/auth/setup." });
  }
  if (!verifyPassword(password, config.dashPasswordHash)) {
    return res.status(401).json({ error: "Wrong password." });
  }
  const token = createSession();
  res.setHeader("Set-Cookie", `sd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.json({ ok: true });
});

router.get("/tasks/pending", (_req, res) => {
  res.json({ tasks: getPendingTasks() });
});

router.get("/tasks/all", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ tasks: getAllTasks({ limit }) });
});

router.post("/tasks/:taskId/approve", async (req, res) => {
  const task = await approveTask(req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found or not pending." });
  res.json({ ok: true, task });
});

router.post("/tasks/:taskId/reject", (req, res) => {
  const reason = req.body.reason || "";
  const task = rejectTask(req.params.taskId, reason);
  if (!task) return res.status(404).json({ error: "Task not found or not pending." });
  res.json({ ok: true, task });
});

router.get("/notifications/sse", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { time: Date.now() });

  const onNewTask = (task) => send("new_task", task);
  const onUpdated = (task) => send("task_updated", task);
  const onBlocked = (alert) => send("command_blocked", alert);

  taskEvents.on("new_task", onNewTask);
  taskEvents.on("task_updated", onUpdated);
  taskEvents.on("command_blocked", onBlocked);

  const heartbeat = setInterval(() => send("ping", { time: Date.now() }), 30_000);

  req.on("close", () => {
    taskEvents.off("new_task", onNewTask);
    taskEvents.off("task_updated", onUpdated);
    taskEvents.off("command_blocked", onBlocked);
    clearInterval(heartbeat);
  });
});

router.get("/history", (req, res) => {
  const { type, status, limit, offset } = req.query;
  res.json(getHistory({
    type,
    status,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  }));
});

router.get("/stats", (_req, res) => {
  res.json(getStats());
});

router.get("/alerts", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(getAlerts({ limit }));
});

router.get("/alerts/unread", (_req, res) => {
  res.json({ unread: getUnreadCount() });
});

router.post("/alerts/mark-read", (_req, res) => {
  markAlertsRead();
  res.json({ ok: true });
});

router.get("/config", (_req, res) => {
  const config = getConfig();
  res.json({
    executionMode: config.executionMode,
    apiPort: config.apiPort,
    dashPort: config.dashPort,
    apiKey: config.apiKey,
    defaultCwd: config.defaultCwd,
    rateLimit: config.rateLimit,
    commandBlacklist: config.commandBlacklist,
  });
});

router.post("/config", (req, res) => {
  const allowedFields = ["executionMode", "defaultCwd", "rateLimit", "commandBlacklist"];
  const patch = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (patch.executionMode && !["approval", "auto"].includes(patch.executionMode)) {
    return res.status(400).json({ error: "executionMode must be 'approval' or 'auto'" });
  }
  const config = updateConfig(patch);
  res.json({ ok: true, config });
});

router.post("/config/regenerate-key", (_req, res) => {
  const newKey = generateApiKey();
  updateConfig({ apiKey: newKey });
  res.json({ ok: true, apiKey: newKey });
});

router.post("/config/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const config = getConfig();
  if (config.dashPasswordHash && !verifyPassword(currentPassword, config.dashPasswordHash)) {
    return res.status(401).json({ error: "Current password is wrong." });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  updateConfig({ dashPasswordHash: hashPassword(newPassword) });
  res.json({ ok: true });
});

router.get("/system", (_req, res) => {
  try {
    const cpuInfo = cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpuInfo) {
      for (const t of Object.values(cpu.times)) totalTick += t;
      totalIdle += cpu.times.idle;
    }
    const cpuUsage = Math.round(((totalTick - totalIdle) / totalTick) * 100);
    const totalMem = totalmem();
    const freeMem = freemem();

    let disk = [];
    try {
      const out = execSync("df -h --output=target,size,used,avail,pcent 2>/dev/null || df -h", { encoding: "utf-8", timeout: 5000 });
      disk = out.trim().split("\n").slice(1).map((l) => {
        const p = l.trim().split(/\s+/);
        return p.length >= 5 ? { mount: p[0], size: p[1], used: p[2], available: p[3], usagePercent: p[4] } : null;
      }).filter((d) => d && d.mount.startsWith("/"));
    } catch {}

    res.json({
      hostname: hostname(), platform: platform(), release: release(), arch: arch(),
      uptime: osUptime(),
      cpu: { model: cpuInfo[0]?.model || "Unknown", cores: cpuInfo.length, usage: cpuUsage },
      memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
      disk,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/terminal/exec", (req, res) => {
  const { cmd, cwd } = req.body;
  if (!cmd || typeof cmd !== "string") {
    return res.status(400).json({ error: "Missing required field: cmd" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const child = executeCommandStream(
    { cmd, cwd },
    (stream, data) => {
      res.write(`data: ${JSON.stringify({ stream, data })}\n\n`);
    },
    (result) => {
      addHistoryEntry({
        type: "exec",
        request: { cmd, cwd },
        description: "Manual execution from Dashboard terminal",
        status: "completed",
        result,
      });
      res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
      res.end();
    }
  );

  res.on("close", () => {
    if (child && !child.killed) child.kill("SIGTERM");
  });
});

router.post("/skill/generate", (req, res) => {
  const { serverAddress, extraNotes, lang } = req.body;
  const markdown = generateSkillDocument({ serverAddress, extraNotes, lang });
  res.json({ markdown });
});

export default router;
