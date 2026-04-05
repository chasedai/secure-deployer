import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getHistoryPath } from "../utils/config.mjs";
import { randomBytes } from "node:crypto";

const MAX_ENTRIES = 1000;
let _entries = [];

export function initHistory() {
  const p = getHistoryPath();
  if (existsSync(p)) {
    try {
      _entries = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      _entries = [];
    }
  }
}

export function addHistoryEntry(entry) {
  const record = {
    id: randomBytes(8).toString("hex"),
    ...entry,
    timestamp: Date.now(),
  };
  _entries.unshift(record);
  if (_entries.length > MAX_ENTRIES) _entries.length = MAX_ENTRIES;
  persist();
  return record;
}

export function getHistory({ type, status, limit = 50, offset = 0 } = {}) {
  let filtered = _entries;
  if (type) filtered = filtered.filter((e) => e.type === type);
  if (status) filtered = filtered.filter((e) => e.status === status);
  return {
    total: filtered.length,
    entries: filtered.slice(offset, offset + limit),
  };
}

export function getHistoryEntry(id) {
  return _entries.find((e) => e.id === id) || null;
}

export function getStats() {
  const now = Date.now();
  const dayMs = 86400_000;

  // Daily counts for last 14 days
  const dailyCounts = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = now - (i + 1) * dayMs;
    const dayEnd = now - i * dayMs;
    const count = _entries.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
    const date = new Date(dayStart);
    dailyCounts.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      count,
    });
  }

  const typeCounts = {};
  for (const e of _entries) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }
  const typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

  const statusCounts = {};
  for (const e of _entries) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  }
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  const recent = _entries.slice(0, 5);

  return { dailyCounts, typeDistribution, statusDistribution, total: _entries.length, recent };
}

function persist() {
  try {
    writeFileSync(getHistoryPath(), JSON.stringify(_entries, null, 2), "utf-8");
  } catch {}
}
