const BASE = "/dash";

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

export const authCheck = () => request<{ passwordSet: boolean }>("/auth/check");
export const authSetup = (password: string) => request<{ ok: boolean }>("/auth/setup", { method: "POST", body: JSON.stringify({ password }) });
export const authLogin = (password: string) => request<{ ok: boolean }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) });

export const getPendingTasks = () => request<{ tasks: Task[] }>("/tasks/pending");
export const getAllTasks = (limit = 50) => request<{ tasks: Task[] }>(`/tasks/all?limit=${limit}`);
export const approveTask = (id: string) => request<{ ok: boolean; task: Task }>(`/tasks/${id}/approve`, { method: "POST" });
export const rejectTask = (id: string, reason = "") => request<{ ok: boolean; task: Task }>(`/tasks/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });

export const getHistory = (params?: { type?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<{ total: number; entries: HistoryEntry[] }>(`/history?${qs}`);
};

export const getStats = () => request<Stats>("/stats");
export const getSystemInfo = () => fetch("/dash/system", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null);

export const getConfig = () => request<Config>("/config");
export const updateConfig = (patch: Partial<Config>) => request<{ ok: boolean; config: Config }>("/config", { method: "POST", body: JSON.stringify(patch) });
export const regenerateKey = () => request<{ ok: boolean; apiKey: string }>("/config/regenerate-key", { method: "POST" });
export const changePassword = (currentPassword: string, newPassword: string) => request<{ ok: boolean }>("/config/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

export const generateSkill = (serverAddress: string, extraNotes = "", lang = "zh") => request<{ markdown: string }>("/skill/generate", { method: "POST", body: JSON.stringify({ serverAddress, extraNotes, lang }) });

export const getAlerts = (limit = 50) => request<{ total: number; unread: number; alerts: Alert[] }>(`/alerts?limit=${limit}`);
export const getUnreadAlertCount = () => request<{ unread: number }>("/alerts/unread");
export const markAlertsRead = () => request<{ ok: boolean }>("/alerts/mark-read", { method: "POST" });

export function connectSSE(onEvent: (event: string, data: unknown) => void): EventSource {
  const es = new EventSource(`${BASE}/notifications/sse`);
  es.addEventListener("new_task", (e) => onEvent("new_task", JSON.parse(e.data)));
  es.addEventListener("task_updated", (e) => onEvent("task_updated", JSON.parse(e.data)));
  es.addEventListener("command_blocked", (e) => onEvent("command_blocked", JSON.parse(e.data)));
  es.addEventListener("ping", () => {});
  es.onerror = () => {};
  return es;
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

export interface Config {
  executionMode: "approval" | "auto";
  apiPort: number;
  dashPort: number;
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
