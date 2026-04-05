import { Router } from "express";
import { createReadStream, existsSync, statSync, renameSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import multer from "multer";
import { listDirectory, readFile, writeFile, deleteFileOrDir } from "../services/fileManager.mjs";
import { createTask } from "../services/taskQueue.mjs";
import { getConfig } from "../utils/config.mjs";

const router = Router();

const upload = multer({
  dest: "/tmp/secure-deployer-uploads",
  limits: { fileSize: 50 * 1024 * 1024 },
});


router.get("/files/list", (req, res) => {
  try {
    const entries = listDirectory(req.query.path);
    res.json({ path: req.query.path, entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/files/read", (req, res) => {
  try {
    if (!req.query.path) return res.status(400).json({ error: "Missing query param: path" });
    const file = readFile(req.query.path);
    res.json(file);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/files/download", (req, res) => {
  try {
    if (!req.query.path) return res.status(400).json({ error: "Missing query param: path" });
    const p = req.query.path;
    if (!existsSync(p)) return res.status(404).json({ error: "File not found" });
    const stat = statSync(p);
    if (stat.isDirectory()) return res.status(400).json({ error: "Cannot download a directory" });
    res.setHeader("Content-Disposition", `attachment; filename="${basename(p)}"`);
    res.setHeader("Content-Length", stat.size);
    createReadStream(p).pipe(res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.post("/files/write", (req, res) => {
  const { path: filePath, content, description } = req.body;
  if (!filePath) return res.status(400).json({ error: "Missing required field: path" });
  if (content === undefined) return res.status(400).json({ error: "Missing required field: content" });
  if (!description) {
    return res.status(400).json({
      error: "Missing required field: description. 你必须说明写入此文件的目的和影响。",
    });
  }

  const config = getConfig();
  if (config.executionMode === "auto") {
    try {
      const result = writeFile(filePath, content);
      return res.json({ status: "completed", result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const task = createTask({
    type: "file_write",
    request: { path: filePath, content },
    description,
  });
  res.status(202).json({
    taskId: task.id,
    status: "pending_approval",
    message: "文件写入请求已提交，等待用户审批。",
  });
});

router.delete("/files/delete", (req, res) => {
  const { path: filePath, description } = req.body;
  if (!filePath) return res.status(400).json({ error: "Missing required field: path" });
  if (!description) {
    return res.status(400).json({
      error: "Missing required field: description. 你必须说明删除此文件/目录的原因。",
    });
  }

  const config = getConfig();
  if (config.executionMode === "auto") {
    try {
      const result = deleteFileOrDir(filePath);
      return res.json({ status: "completed", result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const task = createTask({
    type: "file_delete",
    request: { path: filePath },
    description,
  });
  res.status(202).json({
    taskId: task.id,
    status: "pending_approval",
    message: "删除请求已提交，等待用户审批。",
  });
});

router.post("/files/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const destPath = req.body.path;
  const description = req.body.description;
  if (!destPath) return res.status(400).json({ error: "Missing required field: path (destination)" });
  if (!description) return res.status(400).json({ error: "Missing required field: description." });

  const config = getConfig();
  if (config.executionMode === "auto") {
    try {
      mkdirSync(dirname(destPath), { recursive: true });
      renameSync(req.file.path, destPath);
      return res.json({
        status: "completed",
        result: { path: destPath, size: req.file.size, uploaded: true },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const task = createTask({
    type: "file_upload",
    request: { tempPath: req.file.path, destPath, size: req.file.size },
    description,
  });
  res.status(202).json({
    taskId: task.id,
    status: "pending_approval",
    message: "上传请求已提交，等待用户审批。",
  });
});

export default router;
