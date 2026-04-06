import { getServers } from "./configStore.mjs";

export function generateSkillDocument({ lang = "zh", extraNotes } = {}) {
  const servers = getServers();
  if (lang === "en") return generateEN(servers, extraNotes);
  return generateZH(servers, extraNotes);
}

function serverBlock(servers, lang) {
  if (!servers.length) {
    return lang === "en"
      ? "> No servers configured yet. Add servers in the management client first.\n"
      : "> 尚未配置任何服务器。请先在管理客户端中添加服务器。\n";
  }

  return servers.map((s) => {
    const base = `http://${s.host}:${s.port}`;
    const projects = s.projects?.length
      ? s.projects.map((p) => `  - ${p.name}${p.port ? ` (port ${p.port})` : ""}${p.description ? ` — ${p.description}` : ""}`).join("\n")
      : lang === "en" ? "  - (no projects configured)" : "  - （未配置项目）";
    return `### ${s.name} (${s.host}:${s.port})\n\n- **API**: \`${base}\`\n- **API Key**: \`${s.apiKey}\`\n- **Projects**:\n${projects}`;
  }).join("\n\n");
}

function generateZH(servers, extraNotes) {
  const hasServers = servers.length > 0;
  const firstServer = servers[0];
  const exampleBase = hasServers ? `http://${firstServer.host}:${firstServer.port}` : "http://YOUR_SERVER:9876";
  const exampleKey = hasServers ? firstServer.apiKey : "YOUR_API_KEY";

  return `---
name: secure_deployer
description: 通过 HTTP API 操作远程服务器，支持命令执行、文件管理和系统监控。
---

# Secure Deployer — 远程服务器操作 Skill

## 概述

你可以通过 HTTP API 操作远程服务器。根据任务涉及的项目，选择对应的服务器进行操作。

## 服务器列表

${serverBlock(servers, "zh")}

## 重要规则

1. **每次操作都必须提供 \`description\` 参数**：用自然语言向用户说明这条命令的作用、目的，以及可能存在的风险或副作用。这是必填字段，缺少会被拒绝。
2. 写入操作（命令执行、文件写入、删除等）可能需要用户审批。提交后用 \`GET /api/tasks/:taskId\` 轮询任务状态获取执行结果。
3. 只读操作（查看文件、列目录、查系统信息）不需要审批，直接返回结果。
4. 危险命令（如 \`rm -rf /\`）会被系统自动拦截。
5. 根据任务对应的项目，选择正确的服务器和 API Key。

## API 接口

所有服务器共享相同的 API 格式。将下方示例中的地址和 Key 替换为目标服务器的信息。

### 1. 执行命令

\`\`\`
POST ${exampleBase}/api/exec
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "cmd": "要执行的命令",
  "description": "【必填】说明这条命令做什么、为什么要执行、有什么风险",
  "cwd": "工作目录（可选）",
  "timeout": 60000
}
\`\`\`

返回 \`taskId\`，用下方接口查询结果。

### 2. 查询任务状态

\`\`\`
GET ${exampleBase}/api/tasks/:taskId
Authorization: Bearer ${exampleKey}
\`\`\`

**状态说明**：
- \`pending_approval\` — 等待用户审批，请稍后再查询
- \`approved\` / \`executing\` — 已批准，正在执行
- \`completed\` — 执行完成，\`result\` 含 \`{ exitCode, stdout, stderr, duration }\`
- \`rejected\` — 用户已拒绝，\`rejectReason\` 含拒绝原因

轮询建议：每 2-3 秒查询一次，最多等待 5 分钟。

### 3. 列出目录

\`\`\`
GET ${exampleBase}/api/files/list?path=/home/ubuntu
Authorization: Bearer ${exampleKey}
\`\`\`

### 4. 读取文件

\`\`\`
GET ${exampleBase}/api/files/read?path=/home/ubuntu/app.js
Authorization: Bearer ${exampleKey}
\`\`\`

### 5. 写入/创建文件

\`\`\`
POST ${exampleBase}/api/files/write
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "path": "/home/ubuntu/myapp/config.json",
  "content": "文件内容",
  "description": "【必填】说明写入目的和影响"
}
\`\`\`

### 6. 删除文件/目录

\`\`\`
DELETE ${exampleBase}/api/files/delete
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "path": "/home/ubuntu/myapp/old-build",
  "description": "【必填】说明删除原因和影响"
}
\`\`\`

### 7. 下载文件

\`\`\`
GET ${exampleBase}/api/files/download?path=/home/ubuntu/app.log
Authorization: Bearer ${exampleKey}
\`\`\`

### 8. 系统信息

\`\`\`
GET ${exampleBase}/api/system
Authorization: Bearer ${exampleKey}
\`\`\`

### 9. 健康检查

\`\`\`
GET ${exampleBase}/api/health
\`\`\`

无需认证。

## 注意事项

- 执行命令默认超时 60 秒，最长 5 分钟。长时间命令请设置合适的 timeout。
- 文件读取限制 5MB，更大的文件请用 download 接口。
- 如果命令被拒绝，请根据 rejectReason 调整方案后重新提交。
${extraNotes ? `\n## 补充说明\n\n${extraNotes}\n` : ""}`;
}

function generateEN(servers, extraNotes) {
  const hasServers = servers.length > 0;
  const firstServer = servers[0];
  const exampleBase = hasServers ? `http://${firstServer.host}:${firstServer.port}` : "http://YOUR_SERVER:9876";
  const exampleKey = hasServers ? firstServer.apiKey : "YOUR_API_KEY";

  return `---
name: secure_deployer
description: Operate remote servers via HTTP API. Supports command execution, file management and system monitoring.
---

# Secure Deployer — Remote Server Operation Skill

## Overview

You can operate remote servers through HTTP API calls. Choose the correct server based on the project involved in each task.

## Servers

${serverBlock(servers, "en")}

## Important Rules

1. **Every operation MUST include a \`description\` parameter**: Explain what the command does, why you are running it, and any potential risks. This field is mandatory.
2. Write operations (command execution, file write/delete) may require user approval. After submission, poll \`GET /api/tasks/:taskId\` for results.
3. Read-only operations (list files, read files, system info) return results immediately.
4. Dangerous commands (e.g. \`rm -rf /\`) are automatically blocked.
5. Choose the correct server and API Key based on the project for each task.

## API Endpoints

All servers share the same API format. Replace the URL and Key below with the target server's info.

### 1. Execute Command

\`\`\`
POST ${exampleBase}/api/exec
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "cmd": "command to execute",
  "description": "[REQUIRED] explain what this command does, why, and any risks",
  "cwd": "working directory (optional)",
  "timeout": 60000
}
\`\`\`

Returns \`taskId\`. Use the endpoint below to query results.

### 2. Query Task Status

\`\`\`
GET ${exampleBase}/api/tasks/:taskId
Authorization: Bearer ${exampleKey}
\`\`\`

**Status values**:
- \`pending_approval\` — waiting for user approval
- \`approved\` / \`executing\` — approved and running
- \`completed\` — done, \`result\` contains \`{ exitCode, stdout, stderr, duration }\`
- \`rejected\` — user rejected, \`rejectReason\` contains the reason

Poll every 2-3 seconds, up to 5 minutes.

### 3. List Directory

\`\`\`
GET ${exampleBase}/api/files/list?path=/home/ubuntu
Authorization: Bearer ${exampleKey}
\`\`\`

### 4. Read File

\`\`\`
GET ${exampleBase}/api/files/read?path=/home/ubuntu/app.js
Authorization: Bearer ${exampleKey}
\`\`\`

### 5. Write/Create File

\`\`\`
POST ${exampleBase}/api/files/write
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "path": "/home/ubuntu/myapp/config.json",
  "content": "file content",
  "description": "[REQUIRED] explain the purpose and impact"
}
\`\`\`

### 6. Delete File/Directory

\`\`\`
DELETE ${exampleBase}/api/files/delete
Content-Type: application/json
Authorization: Bearer ${exampleKey}

{
  "path": "/home/ubuntu/myapp/old-build",
  "description": "[REQUIRED] explain why this is being deleted"
}
\`\`\`

### 7. Download File

\`\`\`
GET ${exampleBase}/api/files/download?path=/home/ubuntu/app.log
Authorization: Bearer ${exampleKey}
\`\`\`

### 8. System Info

\`\`\`
GET ${exampleBase}/api/system
Authorization: Bearer ${exampleKey}
\`\`\`

### 9. Health Check

\`\`\`
GET ${exampleBase}/api/health
\`\`\`

No authentication required.

## Notes

- Default command timeout is 60 seconds, maximum 5 minutes.
- File read is limited to 5MB. Use the download endpoint for larger files.
- If a command is rejected, adjust your approach based on the rejectReason and resubmit.
${extraNotes ? `\n## Additional Notes\n\n${extraNotes}\n` : ""}`;
}
