import { getConfig } from "../utils/config.mjs";

export function generateSkillDocument({ serverAddress, apiPort, apiKey, defaultCwd, extraNotes, lang } = {}) {
  const config = getConfig();
  const addr = serverAddress || "YOUR_SERVER_IP";
  const port = apiPort || config.apiPort;
  const key = apiKey || config.apiKey;
  const cwd = defaultCwd || config.defaultCwd;
  const mode = config.executionMode;
  const baseUrl = `http://${addr}:${port}`;

  if (lang === "en") return generateEN({ baseUrl, key, cwd, mode, extraNotes });
  return generateZH({ baseUrl, key, cwd, mode, extraNotes });
}

function generateZH({ baseUrl, key, cwd, mode, extraNotes }) {
  const approvalNote = mode === "approval"
    ? `当前为**审批模式**：你提交的所有写入操作（命令执行、文件写入、删除等）不会立即执行，而是进入审批队列，等待用户在管理界面批准后才会执行。你需要用 \`GET /api/tasks/:taskId\` 轮询任务状态获取执行结果。`
    : `当前为**直接执行模式**：你提交的命令会立即执行，结果直接返回。`;

  return `---
name: secure_deployer
description: 通过 HTTP API 操作远程服务器，支持命令执行、文件管理和系统监控。
---

# Secure Deployer — 远程服务器操作 Skill

## 概述

你可以通过 HTTP API 操作一台远程服务器。所有操作通过 curl 命令完成。

## 连接信息

- **API 地址**：\`${baseUrl}\`
- **认证方式**：在 HTTP Header 中携带 \`Authorization: Bearer ${key}\`
- **默认工作目录**：\`${cwd}\`

## 重要规则

1. **每次操作都必须提供 \`description\` 参数**：用自然语言向用户说明这条命令的作用、目的，以及可能存在的风险或副作用。这是必填字段，缺少会被拒绝。
2. ${approvalNote}
3. 只读操作（查看文件、列目录、查系统信息）不需要审批，直接返回结果。
4. 危险命令（如 \`rm -rf /\`）会被系统自动拦截。

## API 接口

### 1. 执行命令

\`\`\`
POST ${baseUrl}/api/exec
Content-Type: application/json
Authorization: Bearer ${key}

{
  "cmd": "要执行的命令",
  "description": "【必填】说明这条命令做什么、为什么要执行、有什么风险",
  "cwd": "工作目录（可选，默认 ${cwd}）",
  "timeout": 60000,
  "env": {}
}
\`\`\`

${mode === "approval" ? `**审批模式返回**：
\`\`\`json
{ "taskId": "xxx", "status": "pending_approval", "message": "任务已提交，等待用户审批" }
\`\`\`

提交后使用任务查询接口轮询结果（见下方）。` : `**返回**：
\`\`\`json
{ "taskId": "xxx", "status": "completed", "result": { "exitCode": 0, "stdout": "...", "stderr": "...", "duration": 1234 } }
\`\`\``}

### 2. 查询任务状态

\`\`\`
GET ${baseUrl}/api/tasks/:taskId
Authorization: Bearer ${key}
\`\`\`

**返回状态说明**：
- \`pending_approval\` — 等待用户审批，请稍后再查询
- \`approved\` / \`executing\` — 已批准，正在执行
- \`completed\` — 执行完成，\`result\` 字段包含 \`{ exitCode, stdout, stderr, duration }\`
- \`rejected\` — 用户已拒绝，\`rejectReason\` 字段包含拒绝原因

轮询建议：每 2-3 秒查询一次，最多等待 5 分钟。

### 3. 列出目录

\`\`\`
GET ${baseUrl}/api/files/list?path=/home/ubuntu
Authorization: Bearer ${key}
\`\`\`

返回目录中的文件和子目录列表（只读，无需审批）。

### 4. 读取文件

\`\`\`
GET ${baseUrl}/api/files/read?path=/home/ubuntu/app.js
Authorization: Bearer ${key}
\`\`\`

返回文件内容（只读，无需审批，限制 5MB 以下）。

### 5. 写入/创建文件

\`\`\`
POST ${baseUrl}/api/files/write
Content-Type: application/json
Authorization: Bearer ${key}

{
  "path": "/home/ubuntu/myapp/config.json",
  "content": "文件内容",
  "description": "【必填】说明写入目的和影响"
}
\`\`\`

### 6. 删除文件/目录

\`\`\`
DELETE ${baseUrl}/api/files/delete
Content-Type: application/json
Authorization: Bearer ${key}

{
  "path": "/home/ubuntu/myapp/old-build",
  "description": "【必填】说明删除原因和影响"
}
\`\`\`

### 7. 下载文件

\`\`\`
GET ${baseUrl}/api/files/download?path=/home/ubuntu/app.log
Authorization: Bearer ${key}
\`\`\`

返回文件二进制内容（只读，无需审批）。

### 8. 系统信息

\`\`\`
GET ${baseUrl}/api/system
Authorization: Bearer ${key}
\`\`\`

返回 CPU、内存、磁盘使用率及系统负载信息（只读，无需审批）。

### 9. 健康检查

\`\`\`
GET ${baseUrl}/api/health
\`\`\`

无需认证，返回 Agent 运行状态。

## 注意事项

- 执行命令时默认超时 60 秒，最长 5 分钟。长时间命令请设置合适的 timeout。
- 文件读取限制 5MB，更大的文件请用 download 接口。
- 系统信息和文件浏览是即时返回的，不需要走审批流程。
- 如果命令被拒绝，请根据 rejectReason 调整方案后重新提交。
${extraNotes ? `\n## 补充说明\n\n${extraNotes}\n` : ""}`;
}

function generateEN({ baseUrl, key, cwd, mode, extraNotes }) {
  const approvalNote = mode === "approval"
    ? `Currently in **approval mode**: all write operations (command execution, file write/delete) will NOT execute immediately. They enter an approval queue and wait for the user to approve them in the management dashboard. Use \`GET /api/tasks/:taskId\` to poll for results.`
    : `Currently in **auto-execute mode**: commands are executed immediately and results are returned directly.`;

  return `---
name: secure_deployer
description: Operate a remote server via HTTP API. Supports command execution, file management and system monitoring.
---

# Secure Deployer — Remote Server Operation Skill

## Overview

You can operate a remote server through HTTP API calls. All operations are performed via curl commands.

## Connection Info

- **API Endpoint**: \`${baseUrl}\`
- **Authentication**: Include \`Authorization: Bearer ${key}\` in HTTP headers
- **Default Working Directory**: \`${cwd}\`

## Important Rules

1. **Every operation MUST include a \`description\` parameter**: Explain in natural language what the command does, why you are running it, and any potential risks or side effects. This field is mandatory — requests without it will be rejected.
2. ${approvalNote}
3. Read-only operations (list files, read files, system info) do not require approval and return results immediately.
4. Dangerous commands (e.g. \`rm -rf /\`) are automatically blocked by the system.

## API Endpoints

### 1. Execute Command

\`\`\`
POST ${baseUrl}/api/exec
Content-Type: application/json
Authorization: Bearer ${key}

{
  "cmd": "command to execute",
  "description": "[REQUIRED] explain what this command does, why, and any risks",
  "cwd": "working directory (optional, defaults to ${cwd})",
  "timeout": 60000,
  "env": {}
}
\`\`\`

${mode === "approval" ? `**Approval mode response**:
\`\`\`json
{ "taskId": "xxx", "status": "pending_approval", "message": "Task submitted, waiting for user approval" }
\`\`\`

After submission, poll the task status endpoint for results (see below).` : `**Response**:
\`\`\`json
{ "taskId": "xxx", "status": "completed", "result": { "exitCode": 0, "stdout": "...", "stderr": "...", "duration": 1234 } }
\`\`\``}

### 2. Query Task Status

\`\`\`
GET ${baseUrl}/api/tasks/:taskId
Authorization: Bearer ${key}
\`\`\`

**Status values**:
- \`pending_approval\` — waiting for user approval, check again later
- \`approved\` / \`executing\` — approved and running
- \`completed\` — execution finished, \`result\` contains \`{ exitCode, stdout, stderr, duration }\`
- \`rejected\` — user rejected, \`rejectReason\` contains the reason

Recommended: poll every 2–3 seconds, up to 5 minutes.

### 3. List Directory

\`\`\`
GET ${baseUrl}/api/files/list?path=/home/ubuntu
Authorization: Bearer ${key}
\`\`\`

Returns files and subdirectories (read-only, no approval needed).

### 4. Read File

\`\`\`
GET ${baseUrl}/api/files/read?path=/home/ubuntu/app.js
Authorization: Bearer ${key}
\`\`\`

Returns file content (read-only, no approval needed, max 5MB).

### 5. Write/Create File

\`\`\`
POST ${baseUrl}/api/files/write
Content-Type: application/json
Authorization: Bearer ${key}

{
  "path": "/home/ubuntu/myapp/config.json",
  "content": "file content",
  "description": "[REQUIRED] explain the purpose and impact of this write"
}
\`\`\`

### 6. Delete File/Directory

\`\`\`
DELETE ${baseUrl}/api/files/delete
Content-Type: application/json
Authorization: Bearer ${key}

{
  "path": "/home/ubuntu/myapp/old-build",
  "description": "[REQUIRED] explain why this is being deleted and the impact"
}
\`\`\`

### 7. Download File

\`\`\`
GET ${baseUrl}/api/files/download?path=/home/ubuntu/app.log
Authorization: Bearer ${key}
\`\`\`

Returns binary file content (read-only, no approval needed).

### 8. System Info

\`\`\`
GET ${baseUrl}/api/system
Authorization: Bearer ${key}
\`\`\`

Returns CPU, memory, disk usage and system load (read-only, no approval needed).

### 9. Health Check

\`\`\`
GET ${baseUrl}/api/health
\`\`\`

No authentication required. Returns agent running status.

## Notes

- Default command timeout is 60 seconds, maximum 5 minutes. Set an appropriate timeout for long-running commands.
- File read is limited to 5MB. Use the download endpoint for larger files.
- System info and file browsing return instantly without going through the approval process.
- If a command is rejected, adjust your approach based on the rejectReason and resubmit.
${extraNotes ? `\n## Additional Notes\n\n${extraNotes}\n` : ""}`;
}
