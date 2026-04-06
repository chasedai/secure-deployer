<div align="center">

# 🛡️ Secure Deployer

**让 AI 管理你的服务器 — 安全的远程命令执行与管理平台**

[English](./README.md) | 简体中文

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-blue)]()
[![Version](https://img.shields.io/badge/Version-2.0.0-brightgreen)]()

</div>

---

## 这是什么？

Secure Deployer 在 AI 应用和你的服务器之间架起桥梁。轻量级 **Agent** 运行在每台远程服务器上；本地 **Client** 提供统一的管理界面，一处管理所有服务器。

**它解决的问题：**

- AI 应用拒绝处理服务器凭据 → Agent 为 AI 提供安全的 HTTP API 来操作服务器
- 多服务器管理太麻烦 → 一个 Dashboard 管理所有
- 担心 AI 搞坏服务器 → 默认审批模式，每条命令都需要你手动批准
- 不懂技术的用户看不懂命令 → AI 必须为每条命令提供自然语言解释

## 架构

```
┌────────────────────────────────────────────────────────┐
│  你的电脑（本地 Client）                                  │
│  ┌──────────┐ ┌─────────────────────────────────────┐  │
│  │Dashboard │ │ 本地 API    /local/*                 │  │
│  │(React)   │→│ • 服务器管理 • 审批代理               │  │
│  │:9877     │ │ • SSE 聚合  • Skill 生成             │  │
│  └──────────┘ └──────┬────────────────┬──────────────┘  │
└──────────────────────┼────────────────┼─────────────────┘
                       │ HTTP           │ HTTP
          ┌────────────▼──┐    ┌───────▼────────┐
          │ 远程 Agent A   │    │ 远程 Agent B    │
          │ :9876          │    │ :9876           │
          │ /api/* (AI)    │    │ /api/* (AI)     │
          │ /manage/*      │    │ /manage/*       │
          └────────────────┘    └─────────────────┘
```

- **Agent**（远程服务器）：轻量级进程。执行命令、管理文件、监控系统。双 API 层：`/api/*` 给 AI（API Key），`/manage/*` 给 Client（Management Secret）。
- **Client**（你的电脑）：Dashboard + 聚合层。管理多个 Agent，代理审批/历史/告警，生成统一的 Skill 文档。

## 核心特性

**🔒 安全优先**
- 默认审批模式：AI 的每条命令都需要手动批准
- AI 必须用自然语言说明每条命令的目的和风险
- 危险命令自动拦截，实时告警通知
- 双密钥隔离：API Key 给 AI，Management Secret 给 Client

**⚡ 多服务器管理**
- 在同一个界面添加/移除服务器
- 服务器健康状态一目了然
- 统一的 Skill 文档涵盖所有服务器和项目
- 无缝切换服务器

**🛠️ 功能完整**
- 命令执行，流式输出
- 文件浏览器，内置编辑器
- 系统监控（CPU / 内存 / 磁盘）
- 操作历史，可视化统计
- Web 终端，手动执行命令

**🌐 易于使用**
- 可视化 Web 管理界面
- 中英双语
- Agent 和 Client 均提供简洁 CLI

## 快速开始

### 1. 在远程服务器上安装 Agent

```bash
git clone https://github.com/chasedai/secure-deployer.git
cd secure-deployer
npm install
node agent/bin/cli.mjs
```

首次运行时，Agent 会打印凭据：

```
  ★ First run — save these credentials!
  API Key:            sk-xxxxxxxx...
  Management Secret:  ms-xxxxxxxx...
```

保存好这两个值 — 在 Client 端连接时需要用到。

### 2. 在你的电脑上运行 Client

```bash
npm run build   # 构建 Dashboard
node client/bin/cli.mjs
```

### 3. 连接

1. 打开 `http://localhost:9877`，设置管理密码
2. 进入 **服务器管理** → **添加服务器**
3. 填入服务器地址和步骤 1 中获取的凭据
4. 完成！所有功能现在都可以用了

### 4. 生成 Skill，连接 AI

1. 进入 **Skill 生成** → 点击 **生成**
2. 下载 `SKILL.md` 文件
3. 提供给你的 AI 应用（Cursor、openClaw、Claude 等）
4. AI 按照文档调用 API；你在 Dashboard 中审批命令

## CLI 参考

### Agent

```bash
node agent/bin/cli.mjs                   # 启动 Agent（默认）
node agent/bin/cli.mjs credentials       # 显示 API Key 和 Management Secret
node agent/bin/cli.mjs rotate-keys       # 重新生成凭据
node agent/bin/cli.mjs --port 8080       # 自定义端口
node agent/bin/cli.mjs --help            # 帮助
```

### Client

```bash
node client/bin/cli.mjs                  # 启动 Client（默认端口 9877）
node client/bin/cli.mjs --port 3000      # 自定义端口
node client/bin/cli.mjs --help           # 帮助
```

## 两种执行模式

| | 审批模式（默认） | 直接执行模式 |
|---|---|---|
| 安全性 | AI 命令需要手动批准 | 命令立即执行 |
| 适用场景 | 初次使用、不太信任 AI | 熟悉流程、信任 AI |
| 切换方式 | Dashboard → 设置 | Dashboard → 设置 |

## 配置

**Agent 配置**：`~/.secure-deployer/config.json`

```json
{
  "apiPort": 9876,
  "executionMode": "approval",
  "commandBlacklist": ["rm -rf /", "shutdown", "reboot"],
  "rateLimit": { "windowMs": 60000, "max": 60 }
}
```

**Client 配置**：`~/.secure-deployer/client-config.json`

```json
{
  "dashPort": 9877,
  "servers": [
    { "name": "prod", "host": "10.0.1.5", "port": 9876, "managementSecret": "ms-..." }
  ]
}
```

## 技术栈

- **后端**：Node.js + Express
- **前端**：React + TypeScript + Vite + TailwindCSS

## 安全建议

1. 使用强密码保护 Dashboard
2. 用防火墙限制 Agent 端口访问 — 只允许你的 Client IP
3. 先使用审批模式，熟悉后再切换到直接执行
4. 定期查看操作历史
5. 定期使用 `agent rotate-keys` 轮换密钥

## 作者

**Chase Dai** — [GitHub](https://github.com/chasedai) · [Email](mailto:chasedai@qq.com)

## 许可证

[CC BY-NC 4.0](./LICENSE) — 署名后可自由使用和修改，禁止商用。
