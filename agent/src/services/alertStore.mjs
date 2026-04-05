import { randomBytes } from "node:crypto";
import { taskEvents } from "./taskQueue.mjs";
import { addHistoryEntry } from "./history.mjs";

const MAX_ALERTS = 200;
const _alerts = [];
let _unreadCount = 0;

export function recordBlockedCommand({ cmd, description, matchedPatterns }) {
  const alert = {
    id: randomBytes(8).toString("hex"),
    cmd,
    description: description || "",
    matchedPatterns,
    timestamp: Date.now(),
    read: false,
  };
  _alerts.unshift(alert);
  if (_alerts.length > MAX_ALERTS) _alerts.length = MAX_ALERTS;
  _unreadCount++;

  addHistoryEntry({
    type: "exec",
    request: { cmd },
    description: description || "N/A",
    status: "blocked",
    result: { blocked: true, matchedPatterns },
  });

  taskEvents.emit("command_blocked", alert);
  return alert;
}

export function getAlerts({ limit = 50, offset = 0 } = {}) {
  return {
    total: _alerts.length,
    unread: _unreadCount,
    alerts: _alerts.slice(offset, offset + limit),
  };
}

export function getUnreadCount() {
  return _unreadCount;
}

export function markAlertsRead() {
  for (const a of _alerts) a.read = true;
  _unreadCount = 0;
}
