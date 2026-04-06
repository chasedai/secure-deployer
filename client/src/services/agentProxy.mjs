import { getServer, getServers } from "./configStore.mjs";

function manageUrl(server, path) {
  return `http://${server.host}:${server.port}/manage${path}`;
}

function apiUrl(server, path) {
  return `http://${server.host}:${server.port}/api${path}`;
}

async function apiRequest(serverId, path, options = {}) {
  const server = getServer(serverId);
  if (!server) throw new Error(`Server not found: ${serverId}`);

  const url = apiUrl(server, path);
  const headers = {
    Authorization: `Bearer ${server.apiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10_000);

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function apiRequestRaw(serverId, path) {
  const server = getServer(serverId);
  if (!server) throw new Error(`Server not found: ${serverId}`);
  const url = apiUrl(server, path);
  return fetch(url, { headers: { Authorization: `Bearer ${server.apiKey}` } });
}

async function manageRequest(serverId, path, options = {}) {
  const server = getServer(serverId);
  if (!server) throw new Error(`Server not found: ${serverId}`);

  const url = manageUrl(server, path);
  const headers = {
    Authorization: `Bearer ${server.managementSecret}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10_000);

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkHealth(serverId) {
  const server = getServer(serverId);
  if (!server) return { ok: false, error: "Server not found" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`http://${server.host}:${server.port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function checkAllHealth() {
  const servers = getServers();
  const results = await Promise.allSettled(
    servers.map(async (s) => {
      const health = await checkHealth(s.id);
      return { serverId: s.id, name: s.name, ...health };
    })
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message }));
}

export function getPendingTasks(serverId) {
  return manageRequest(serverId, "/tasks/pending");
}

export function getAllTasks(serverId, limit = 50) {
  return manageRequest(serverId, `/tasks/all?limit=${limit}`);
}

export function approveTask(serverId, taskId) {
  return manageRequest(serverId, `/tasks/${taskId}/approve`, { method: "POST" });
}

export function rejectTask(serverId, taskId, reason = "") {
  return manageRequest(serverId, `/tasks/${taskId}/reject`, { method: "POST", body: { reason } });
}

export function getHistory(serverId, { type, status, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  return manageRequest(serverId, `/history?${params}`);
}

export function getStats(serverId) {
  return manageRequest(serverId, "/stats");
}

export function getAlerts(serverId, limit = 50) {
  return manageRequest(serverId, `/alerts?limit=${limit}`);
}

export function getUnreadAlertCount(serverId) {
  return manageRequest(serverId, "/alerts/unread");
}

export function markAlertsRead(serverId) {
  return manageRequest(serverId, "/alerts/mark-read", { method: "POST" });
}

export function getAgentConfig(serverId) {
  return manageRequest(serverId, "/config");
}

export function updateAgentConfig(serverId, patch) {
  return manageRequest(serverId, "/config", { method: "POST", body: patch });
}

export function regenerateAgentKey(serverId) {
  return manageRequest(serverId, "/config/regenerate-key", { method: "POST" });
}

export function getSystemInfo(serverId) {
  return manageRequest(serverId, "/system");
}

export function createSSEConnection(serverId) {
  const server = getServer(serverId);
  if (!server) return null;

  const url = manageUrl(server, "/notifications/sse");
  const headers = { Authorization: `Bearer ${server.managementSecret}` };

  return { url, headers, serverId, serverName: server.name };
}

export function getTerminalExecUrl(serverId) {
  const server = getServer(serverId);
  if (!server) return null;
  return {
    url: manageUrl(server, "/terminal/exec"),
    secret: server.managementSecret,
  };
}

export function filesList(serverId, path) {
  return apiRequest(serverId, `/files/list?path=${encodeURIComponent(path || "")}`);
}

export function filesRead(serverId, path) {
  return apiRequest(serverId, `/files/read?path=${encodeURIComponent(path)}`);
}

export function filesWrite(serverId, path, content, description) {
  return apiRequest(serverId, "/files/write", {
    method: "POST",
    body: { path, content, description },
  });
}

export function filesDelete(serverId, path, description) {
  return apiRequest(serverId, "/files/delete", {
    method: "DELETE",
    body: { path, description },
  });
}

export function filesDownloadRaw(serverId, path) {
  return apiRequestRaw(serverId, `/files/download?path=${encodeURIComponent(path)}`);
}
