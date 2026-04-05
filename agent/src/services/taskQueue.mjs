import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { executeCommand } from "./executor.mjs";
import { addHistoryEntry } from "./history.mjs";
import { getConfig } from "../utils/config.mjs";

export const taskEvents = new EventEmitter();
taskEvents.setMaxListeners(50);

const tasks = new Map();

const TASK_TTL = 3600_000; // 1h auto-cleanup

export function createTask({ type, request, description }) {
  const config = getConfig();
  const id = randomBytes(12).toString("hex");
  const task = {
    id,
    type,
    request,
    description,
    status: config.executionMode === "auto" ? "approved" : "pending_approval",
    result: null,
    rejectReason: null,
    createdAt: Date.now(),
    completedAt: null,
  };
  tasks.set(id, task);

  scheduleCleanup(id);

  if (task.status === "approved") {
    runTask(task);
  } else {
    taskEvents.emit("new_task", task);
  }

  return task;
}

export function getTask(id) {
  return tasks.get(id) || null;
}

export function getPendingTasks() {
  return [...tasks.values()]
    .filter((t) => t.status === "pending_approval")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllTasks({ limit = 50 } = {}) {
  return [...tasks.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export async function approveTask(id) {
  const task = tasks.get(id);
  if (!task || task.status !== "pending_approval") return null;
  task.status = "approved";
  taskEvents.emit("task_updated", task);
  await runTask(task);
  return task;
}

export function rejectTask(id, reason = "") {
  const task = tasks.get(id);
  if (!task || task.status !== "pending_approval") return null;
  task.status = "rejected";
  task.rejectReason = reason;
  task.completedAt = Date.now();
  taskEvents.emit("task_updated", task);
  addHistoryEntry({
    type: task.type,
    request: task.request,
    description: task.description,
    status: "rejected",
    rejectReason: reason,
  });
  return task;
}

async function runTask(task) {
  task.status = "executing";
  taskEvents.emit("task_updated", task);

  try {
    let result;
    if (task.type === "exec") {
      result = await executeCommand(task.request);
    } else if (task.type === "file_write" || task.type === "file_delete" || task.type === "file_upload") {
      const { performFileOperation } = await import("./fileManager.mjs");
      result = await performFileOperation(task.type, task.request);
    }
    task.status = "completed";
    task.result = result;
    task.completedAt = Date.now();
  } catch (err) {
    task.status = "completed";
    task.result = { error: err.message, exitCode: 1 };
    task.completedAt = Date.now();
  }

  taskEvents.emit("task_updated", task);
  addHistoryEntry({
    type: task.type,
    request: task.request,
    description: task.description,
    status: task.status,
    result: task.result,
  });
  return task;
}

function scheduleCleanup(id) {
  setTimeout(() => tasks.delete(id), TASK_TTL);
}
