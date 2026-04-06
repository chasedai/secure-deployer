const BASE = "/local";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers as Record<string, string>) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// Auth (client-local)
export const authCheck = () => request<{ passwordSet: boolean }>("/auth/check");
export const authSetup = (password: string) => request<{ ok: boolean }>("/auth/setup", { method: "POST", body: JSON.stringify({ password }) });
export const authLogin = (password: string) => request<{ ok: boolean }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) });
export const changePassword = (currentPassword: string, newPassword: string) => request<{ ok: boolean }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

// Server management
export const getServers = () => request<{ servers: Server[] }>("/servers");
export const addServer = (data: Partial<Server>) => request<{ ok: boolean; server: Server }>("/servers", { method: "POST", body: JSON.stringify(data) });
export const updateServerAPI = (id: string, data: Partial<Server>) => request<{ ok: boolean; server: Server }>(`/servers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const removeServer = (id: string) => request<{ ok: boolean }>(`/servers/${id}`, { method: "DELETE" });
export const checkServerHealth = (id: string) => request<{ ok: boolean; status?: string; version?: string }>(`/servers/${id}/health`);

// Per-server: Tasks
export const getPendingTasks = (sid: string) => request<{ tasks: Task[] }>(`/servers/${sid}/tasks/pending`);
export const getAllTasks = (sid: string, limit = 50) => request<{ tasks: Task[] }>(`/servers/${sid}/tasks/all?limit=${limit}`);
export const approveTask = (sid: string, id: string) => request<{ ok: boolean; task: Task }>(`/servers/${sid}/tasks/${id}/approve`, { method: "POST" });
export const rejectTask = (sid: string, id: string, reason = "") => request<{ ok: boolean; task: Task }>(`/servers/${sid}/tasks/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });

// Per-server: History & Stats
export const getHistory = (sid: string, params?: { type?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<{ total: number; entries: HistoryEntry[] }>(`/servers/${sid}/history?${qs}`);
};
export const getStats = (sid: string) => request<Stats>(`/servers/${sid}/stats`);

// Per-server: System & Config
export const getSystemInfo = (sid: string) => request<SystemInfo>(`/servers/${sid}/system`);
export const getAgentConfig = (sid: string) => request<AgentConfig>(`/servers/${sid}/config`);
export const updateAgentConfig = (sid: string, patch: Partial<AgentConfig>) => request<{ ok: boolean; config: AgentConfig }>(`/servers/${sid}/config`, { method: "POST", body: JSON.stringify(patch) });
export const regenerateKey = (sid: string) => request<{ ok: boolean; apiKey: string }>(`/servers/${sid}/config/regenerate-key`, { method: "POST" });

// Per-server: Alerts
export const getAlerts = (sid: string, limit = 50) => request<{ total: number; unread: number; alerts: Alert[] }>(`/servers/${sid}/alerts?limit=${limit}`);
export const getUnreadAlertCount = (sid: string) => request<{ unread: number }>(`/servers/${sid}/alerts/unread`);
export const markAlertsRead = (sid: string) => request<{ ok: boolean }>(`/servers/${sid}/alerts/mark-read`, { method: "POST" });

// Per-server: Files
export const filesList = (sid: string, path: string) => request<{ path: string; entries: FileEntry[] }>(`/servers/${sid}/files/list?path=${encodeURIComponent(path)}`);
export const filesRead = (sid: string, path: string) => request<{ path: string; content: string; size: number }>(`/servers/${sid}/files/read?path=${encodeURIComponent(path)}`);
export const filesWrite = (sid: string, path: string, content: string, description: string) => request<unknown>(`/servers/${sid}/files/write`, { method: "POST", body: JSON.stringify({ path, content, description }) });
export const filesDelete = (sid: string, path: string, description: string) => request<unknown>(`/servers/${sid}/files/delete`, { method: "DELETE", body: JSON.stringify({ path, description }) });
export const filesDownloadUrl = (sid: string, path: string) => `${BASE}/servers/${sid}/files/download?path=${encodeURIComponent(path)}`;

// Per-server: SSE
export function connectSSE(sid: string, onEvent: (event: string, data: unknown) => void): EventSource {
  const es = new EventSource(`${BASE}/servers/${sid}/notifications/sse`);
  es.addEventListener("new_task", (e) => onEvent("new_task", JSON.parse(e.data)));
  es.addEventListener("task_updated", (e) => onEvent("task_updated", JSON.parse(e.data)));
  es.addEventListener("command_blocked", (e) => onEvent("command_blocked", JSON.parse(e.data)));
  es.addEventListener("ping", () => {});
  es.onerror = () => {};
  return es;
}

// Skill generation (local)
export const generateSkill = (lang = "zh", extraNotes = "") => request<{ markdown: string }>("/skill/generate", { method: "POST", body: JSON.stringify({ lang, extraNotes }) });

// Types
export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey: string;
  managementSecret: string;
  projects: { name: string; port?: number; description?: string }[];
  createdAt: number;
}

export interface Task {
  id: string;
  type: string;
  request: Record<string, unknown>;
  description: string;
  status: "pending_approval" | "approved" | "executing" | "completed" | "rejected";
  result: Record<string, unknown> | null;
  rejectReason: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface HistoryEntry {
  id: string;
  type: string;
  request: Record<string, unknown>;
  description: string;
  status: string;
  result?: Record<string, unknown>;
  rejectReason?: string;
  timestamp: number;
}

export interface AgentConfig {
  executionMode: "approval" | "auto";
  apiPort: number;
  apiKey: string;
  defaultCwd: string;
  rateLimit: { windowMs: number; max: number };
  commandBlacklist: string[];
}

export interface Alert {
  id: string;
  cmd: string;
  description: string;
  matchedPatterns: string[];
  timestamp: number;
  read: boolean;
}

export interface Stats {
  dailyCounts: { date: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  total: number;
  recent: HistoryEntry[];
}

export interface SystemInfo {
  hostname: string; platform: string; release: string; arch: string; uptime: number;
  cpu: { model: string; cores: number; usage: number };
  memory: { total: number; free: number; used: number; usagePercent: number };
  disk: { mount: string; size: string; used: string; available: string; usagePercent: string }[];
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string | null;
}
