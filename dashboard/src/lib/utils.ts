export function timeAgo(ts: number, t: (k: string, ...a: (string | number)[]) => string): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return t("time.secAgo", seconds);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minAgo", minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hourAgo", hours);
  const days = Math.floor(hours / 24);
  return t("time.dayAgo", days);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function statusLabel(status: string, t: (k: string) => string): { text: string; color: string } {
  const colors: Record<string, string> = {
    pending_approval: "text-amber-600",
    approved: "text-blue-600",
    executing: "text-blue-600",
    completed: "text-green-600",
    rejected: "text-red-500",
    blocked: "text-red-600",
  };
  return { text: t(`status.${status}`), color: colors[status] || "text-gray-500" };
}

export function taskTypeLabel(type: string, t: (k: string) => string): string {
  return t(`type.${type}`);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
