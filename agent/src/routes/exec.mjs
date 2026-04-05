import { Router } from "express";
import { createTask, getTask } from "../services/taskQueue.mjs";
import { executeCommandStream } from "../services/executor.mjs";
import { isCommandBlacklisted, matchedBlacklistPatterns } from "../utils/security.mjs";
import { getConfig } from "../utils/config.mjs";
import { recordBlockedCommand } from "../services/alertStore.mjs";

const router = Router();

router.post("/exec", (req, res) => {
  const { cmd, description, cwd, timeout, env } = req.body;

  if (!cmd || typeof cmd !== "string") {
    return res.status(400).json({ error: "Missing required field: cmd" });
  }
  if (!description || typeof description !== "string") {
    return res.status(400).json({
      error: "Missing required field: description. 你必须说明这条命令的作用、目的和潜在风险。",
    });
  }

  const config = getConfig();
  if (isCommandBlacklisted(cmd, config.commandBlacklist)) {
    const matched = matchedBlacklistPatterns(cmd, config.commandBlacklist);
    recordBlockedCommand({ cmd, description, matchedPatterns: matched });
    return res.status(403).json({ error: "Command blocked by security policy.", cmd });
  }

  const task = createTask({
    type: "exec",
    request: { cmd, cwd, timeout, env },
    description,
  });

  if (task.status === "completed") {
    return res.json({ taskId: task.id, status: task.status, result: task.result });
  }
  if (task.status === "pending_approval") {
    return res.status(202).json({
      taskId: task.id,
      status: "pending_approval",
      message: "任务已提交，等待用户审批。请用 GET /api/tasks/" + task.id + " 查询结果。",
    });
  }
  res.status(202).json({
    taskId: task.id,
    status: task.status,
    message: "命令已提交，正在执行。请用 GET /api/tasks/" + task.id + " 查询结果。",
  });
});

router.post("/exec/stream", (req, res) => {
  const { cmd, description, cwd, timeout, env } = req.body;

  if (!cmd || !description) {
    return res.status(400).json({ error: "Missing required fields: cmd, description" });
  }

  const config = getConfig();
  if (config.executionMode === "approval") {
    return res.status(400).json({
      error: "Streaming not supported in approval mode. Use POST /api/exec instead.",
    });
  }
  if (isCommandBlacklisted(cmd, config.commandBlacklist)) {
    const matched = matchedBlacklistPatterns(cmd, config.commandBlacklist);
    recordBlockedCommand({ cmd, description, matchedPatterns: matched });
    return res.status(403).json({ error: "Command blocked by security policy." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  executeCommandStream(
    { cmd, cwd, timeout, env },
    (stream, data) => {
      res.write(`data: ${JSON.stringify({ stream, data })}\n\n`);
    },
    (result) => {
      res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
      res.end();
    }
  );

  res.on("close", () => res.end());
});

export default router;
