import { Router } from "express";
import {
  getConfig, updateConfig,
  hashPassword, verifyPassword, generateSessionToken,
  addServer, updateServer, removeServer, getServers, getServer,
  getAIConfig, updateAIConfig, isAIConfigured,
} from "../services/configStore.mjs";
import * as proxy from "../services/agentProxy.mjs";
import { generateSkillDocument } from "../services/skillGen.mjs";
import { getChat, clearChat, setAutoApprove } from "../services/chatStore.mjs";
import { runChatTurn } from "../services/aiClient.mjs";
import { runScan, getLatestScan, getRunningScan, isScanRunning } from "../services/securityScan.mjs";

const router = Router();
const sessions = new Map();
const SESSION_TTL = 24 * 3600_000;

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function authMiddleware(req, res, next) {
  const openPaths = ["/local/auth/login", "/local/auth/setup", "/local/auth/check"];
  if (openPaths.includes(req.path)) return next();
  if (!req.path.startsWith("/local/")) return next();

  const token = parseCookie(req.headers.cookie, "sd_session");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  const session = sessions.get(token);
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return res.status(401).json({ error: "Session expired." });
  }
  next();
}

router.use(authMiddleware);

// --- Auth ---

router.get("/auth/check", (_req, res) => {
  res.json({ passwordSet: !!getConfig().dashPasswordHash });
});

router.post("/auth/setup", (req, res) => {
  if (getConfig().dashPasswordHash) {
    return res.status(400).json({ error: "Password already set." });
  }
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  updateConfig({ dashPasswordHash: hashPassword(password) });
  const token = generateSessionToken();
  sessions.set(token, { createdAt: Date.now() });
  setTimeout(() => sessions.delete(token), SESSION_TTL);
  res.setHeader("Set-Cookie", `sd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.json({ ok: true });
});

router.post("/auth/login", (req, res) => {
  const { password } = req.body;
  const config = getConfig();
  if (!config.dashPasswordHash) return res.status(400).json({ error: "Password not set." });
  if (!verifyPassword(password, config.dashPasswordHash)) {
    return res.status(401).json({ error: "Wrong password." });
  }
  const token = generateSessionToken();
  sessions.set(token, { createdAt: Date.now() });
  setTimeout(() => sessions.delete(token), SESSION_TTL);
  res.setHeader("Set-Cookie", `sd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.json({ ok: true });
});

router.post("/auth/change-password", (req, res) => {
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

// --- Server Management ---

router.get("/servers", (_req, res) => {
  res.json({ servers: getServers() });
});

router.get("/servers/:id", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json({ server });
});

router.post("/servers", (req, res) => {
  const { name, host, port, apiKey, managementSecret, projects } = req.body;
  if (!host) return res.status(400).json({ error: "host is required" });
  if (!managementSecret) return res.status(400).json({ error: "managementSecret is required" });
  const server = addServer({ name, host, port, apiKey, managementSecret, projects });
  res.json({ ok: true, server });
});

router.put("/servers/:id", (req, res) => {
  const server = updateServer(req.params.id, req.body);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json({ ok: true, server });
});

router.delete("/servers/:id", (req, res) => {
  const ok = removeServer(req.params.id);
  if (!ok) return res.status(404).json({ error: "Server not found" });
  res.json({ ok: true });
});

router.get("/servers/:id/health", async (req, res) => {
  const result = await proxy.checkHealth(req.params.id);
  res.json(result);
});

router.get("/servers/health/all", async (_req, res) => {
  const results = await proxy.checkAllHealth();
  res.json({ servers: results });
});

// --- Proxy to Agent: Tasks ---

router.get("/servers/:id/tasks/pending", async (req, res) => {
  try {
    const data = await proxy.getPendingTasks(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/servers/:id/tasks/all", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await proxy.getAllTasks(req.params.id, limit);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/servers/:id/tasks/:taskId/approve", async (req, res) => {
  try {
    const data = await proxy.approveTask(req.params.id, req.params.taskId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/servers/:id/tasks/:taskId/reject", async (req, res) => {
  try {
    const reason = req.body.reason || "";
    const data = await proxy.rejectTask(req.params.id, req.params.taskId, reason);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Proxy to Agent: History & Stats ---

router.get("/servers/:id/history", async (req, res) => {
  try {
    const data = await proxy.getHistory(req.params.id, req.query);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/servers/:id/stats", async (req, res) => {
  try {
    const data = await proxy.getStats(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Proxy to Agent: Alerts ---

router.get("/servers/:id/alerts", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await proxy.getAlerts(req.params.id, limit);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/servers/:id/alerts/unread", async (req, res) => {
  try {
    const data = await proxy.getUnreadAlertCount(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/servers/:id/alerts/mark-read", async (req, res) => {
  try {
    const data = await proxy.markAlertsRead(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Proxy to Agent: Config ---

router.get("/servers/:id/config", async (req, res) => {
  try {
    const data = await proxy.getAgentConfig(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/servers/:id/config", async (req, res) => {
  try {
    const data = await proxy.updateAgentConfig(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/servers/:id/config/regenerate-key", async (req, res) => {
  try {
    const data = await proxy.regenerateAgentKey(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Proxy to Agent: System ---

router.get("/servers/:id/system", async (req, res) => {
  try {
    const data = await proxy.getSystemInfo(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Proxy to Agent: SSE ---

router.get("/servers/:id/notifications/sse", (req, res) => {
  const conn = proxy.createSSEConnection(req.params.id);
  if (!conn) return res.status(404).json({ error: "Server not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let aborted = false;
  const controller = new AbortController();

  fetch(conn.url, {
    headers: conn.headers,
    signal: controller.signal,
  }).then(async (upstream) => {
    if (!upstream.ok || !upstream.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Failed to connect to agent SSE" })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch {}
    if (!aborted) res.end();
  }).catch((err) => {
    if (!aborted) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  req.on("close", () => {
    aborted = true;
    controller.abort();
  });
});

// --- Proxy to Agent: Terminal ---

router.post("/servers/:id/terminal/exec", (req, res) => {
  const info = proxy.getTerminalExecUrl(req.params.id);
  if (!info) return res.status(404).json({ error: "Server not found" });

  const { cmd, cwd } = req.body;
  if (!cmd) return res.status(400).json({ error: "Missing cmd" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let aborted = false;
  const controller = new AbortController();

  fetch(info.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${info.secret}`,
    },
    body: JSON.stringify({ cmd, cwd }),
    signal: controller.signal,
  }).then(async (upstream) => {
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ done: true, exitCode: 1, error: "Failed to connect to agent" })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch {}
    if (!aborted) res.end();
  }).catch((err) => {
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ done: true, exitCode: 1, error: err.message })}\n\n`);
      res.end();
    }
  });

  req.on("close", () => {
    aborted = true;
    controller.abort();
  });
});

// --- Proxy to Agent: Files ---

router.get("/servers/:id/files/list", async (req, res) => {
  try { res.json(await proxy.filesList(req.params.id, req.query.path)); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

router.get("/servers/:id/files/read", async (req, res) => {
  try { res.json(await proxy.filesRead(req.params.id, req.query.path)); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

router.post("/servers/:id/files/write", async (req, res) => {
  try {
    const { path: fp, content, description } = req.body;
    res.json(await proxy.filesWrite(req.params.id, fp, content, description));
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.delete("/servers/:id/files/delete", async (req, res) => {
  try {
    const { path: fp, description } = req.body;
    res.json(await proxy.filesDelete(req.params.id, fp, description));
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get("/servers/:id/files/download", async (req, res) => {
  try {
    const upstream = await proxy.filesDownloadRaw(req.params.id, req.query.path);
    if (!upstream.ok) return res.status(upstream.status).json({ error: "Download failed" });
    for (const [key, val] of upstream.headers) {
      if (["content-type", "content-disposition", "content-length"].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    }
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// --- AI Config ---

function redactAIConfig(cfg) {
  const apiKey = cfg.apiKey || "";
  const masked = apiKey.length > 8 ? apiKey.slice(0, 6) + "..." + apiKey.slice(-4) : apiKey ? "***" : "";
  return { ...cfg, apiKey: masked, apiKeySet: Boolean(apiKey) };
}

router.get("/ai-config", (_req, res) => {
  res.json({ config: redactAIConfig(getAIConfig()), configured: isAIConfigured() });
});

router.post("/ai-config", (req, res) => {
  const { baseURL, apiKey, model, temperature, maxTokens } = req.body || {};
  const patch = {};
  if (typeof baseURL === "string") patch.baseURL = baseURL.trim().replace(/\/+$/, "");
  if (typeof apiKey === "string" && apiKey && !apiKey.includes("...")) patch.apiKey = apiKey.trim();
  if (typeof model === "string") patch.model = model.trim();
  if (typeof temperature === "number") patch.temperature = Math.max(0, Math.min(2, temperature));
  if (typeof maxTokens === "number") patch.maxTokens = Math.max(256, Math.min(32000, Math.floor(maxTokens)));
  const next = updateAIConfig(patch);
  res.json({ config: redactAIConfig(next), configured: isAIConfigured() });
});

router.post("/ai-config/test", async (_req, res) => {
  const cfg = getAIConfig();
  if (!cfg.apiKey) {
    return res.status(400).json({ ok: false, error: "API Key not configured." });
  }
  try {
    const url = `${cfg.baseURL.replace(/\/+$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `HTTP ${resp.status} — ${text.slice(0, 400)}` });
    }
    const data = await resp.json();
    const model = data.model || cfg.model;
    res.json({ ok: true, model, message: "Connection successful." });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || String(err) });
  }
});

// --- AI Chat (per-server) ---

router.get("/servers/:id/chat", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const chat = getChat(req.params.id);
  res.json({ messages: chat.messages, autoApprove: chat.autoApprove });
});

router.delete("/servers/:id/chat", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  clearChat(req.params.id);
  res.json({ ok: true });
});

router.post("/servers/:id/chat/auto-approve", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const { enabled } = req.body || {};
  const chat = setAutoApprove(req.params.id, Boolean(enabled));
  res.json({ autoApprove: chat.autoApprove });
});

router.post("/servers/:id/chat/message", async (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const { content } = req.body || {};
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  if (res.socket && typeof res.socket.setNoDelay === "function") {
    res.socket.setNoDelay(true);
    try { res.socket.setKeepAlive(true); } catch {}
  }
  // Kick the stream with 2KB of padding so browsers and any reverse proxies
  // (nginx/Cloudflare/etc.) release their initial buffer immediately.
  try { res.write(`:${" ".repeat(2048)}\n\n`); } catch {}

  let closed = false;
  const emit = (event) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {}
  };

  const heartbeat = setInterval(() => {
    if (closed) return;
    try { res.write(`: keepalive ${Date.now()}\n\n`); } catch {}
  }, 5000);

  req.on("close", () => { closed = true; clearInterval(heartbeat); });

  try {
    await runChatTurn({ serverId: req.params.id, userMessage: content, emit });
    emit({ type: "done" });
  } catch (err) {
    emit({ type: "error", error: err.message || String(err) });
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
});

// --- Security Scan (per-server) ---

router.get("/servers/:id/scan", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json({
    latest: getLatestScan(req.params.id),
    running: isScanRunning(req.params.id) ? getRunningScan(req.params.id) : null,
  });
});

router.post("/servers/:id/scan/start", (req, res) => {
  const server = getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (isScanRunning(req.params.id)) {
    return res.status(409).json({ error: "A scan is already running for this server." });
  }
  runScan(req.params.id).catch((err) => {
    console.error("[scan] error:", err.message);
  });
  res.json({ ok: true, running: getRunningScan(req.params.id) });
});

// --- Skill Generation ---

router.post("/skill/generate", (req, res) => {
  const { lang, extraNotes, serverId } = req.body;
  if (!serverId) {
    return res.status(400).json({ error: "serverId is required" });
  }
  try {
    const markdown = generateSkillDocument({ lang, extraNotes, serverId });
    res.json({ markdown });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
