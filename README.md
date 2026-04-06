<div align="center">

# 🛡️ Secure Deployer

**Let AI manage your servers — secure remote command execution & management platform**

English | [简体中文](./README_CN.md)

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-blue)]()
[![Version](https://img.shields.io/badge/Version-2.0.0-brightgreen)]()

</div>

---

## What is this?

Secure Deployer bridges the gap between AI applications and your servers. A lightweight **Agent** runs on each remote server; a local **Client** provides a unified dashboard to manage all servers from one place.

**Problems it solves:**

- AI applications refuse to handle server credentials → Agent provides a secure HTTP API for AI to operate your server
- Managing multiple servers is painful → One dashboard to rule them all
- Worried about AI messing up your server → Default approval mode requires your explicit approval for every command
- Non-technical users can't understand shell commands → AI must provide a natural language explanation for every command

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Your Machine (Local Client)                           │
│  ┌──────────┐ ┌─────────────────────────────────────┐  │
│  │Dashboard │ │ Local API   /local/*                 │  │
│  │(React)   │→│ • Server CRUD • Approval proxy      │  │
│  │:9877     │ │ • SSE aggregation • Skill generation │  │
│  └──────────┘ └──────┬────────────────┬──────────────┘  │
└──────────────────────┼────────────────┼─────────────────┘
                       │ HTTP           │ HTTP
          ┌────────────▼──┐    ┌───────▼────────┐
          │ Remote Agent A │    │ Remote Agent B  │
          │ :9876          │    │ :9876           │
          │ /api/* (AI)    │    │ /api/* (AI)     │
          │ /manage/*      │    │ /manage/*       │
          └────────────────┘    └─────────────────┘
```

- **Agent** (remote servers): Lightweight process. Executes commands, manages files, monitors system. Two API layers: `/api/*` for AI (API Key), `/manage/*` for the Client (Management Secret).
- **Client** (your machine): Dashboard + aggregation layer. Manages multiple agents, proxies approval/history/alerts, generates a unified Skill document.

## Key Features

**🔒 Security First**
- Default approval mode: every AI command requires manual approval
- AI must describe the purpose and risks of every command in natural language
- Dangerous commands are automatically blocked with real-time alerts
- Dual-key isolation: API Key for AI, Management Secret for the Client

**⚡ Multi-Server Management**
- Add/remove servers from one dashboard
- Server health monitoring at a glance
- Unified Skill document covers all servers and projects
- Seamless server switching

**🛠️ Full Featured**
- Command execution with streaming output
- File browser with inline editor
- System monitoring (CPU / memory / disk)
- Operation history with visual statistics
- Web terminal for manual commands

**🌐 User Friendly**
- Web-based visual management dashboard
- Bilingual interface (English / 中文)
- Simple CLI for both Agent and Client

## Quick Start

### 1. Install Agent on each remote server

```bash
# Clone and start
git clone https://github.com/chasedai/secure-deployer.git
cd secure-deployer
npm install
node agent/bin/cli.mjs
```

On first run, the Agent prints credentials:

```
  ★ First run — save these credentials!
  API Key:            sk-xxxxxxxx...
  Management Secret:  ms-xxxxxxxx...
```

Save both values — you'll need them to connect from the Client.

### 2. Run Client on your machine

```bash
npm run build   # Build the dashboard
node client/bin/cli.mjs
```

### 3. Connect

1. Open `http://localhost:9877` and set an admin password
2. Go to **Server Management** → **Add Server**
3. Enter the server address and credentials from step 1
4. That's it! All features are now available for this server

### 4. Generate Skill & connect AI

1. Go to **Skill Gen** → click **Generate**
2. Download the `SKILL.md` file
3. Provide it to your AI application (Cursor, openClaw, Claude, etc.)
4. AI calls the API according to the document; you approve commands in the dashboard

## CLI Reference

### Agent

```bash
node agent/bin/cli.mjs                   # Start agent (default)
node agent/bin/cli.mjs credentials       # Show API Key & Management Secret
node agent/bin/cli.mjs rotate-keys       # Generate new credentials
node agent/bin/cli.mjs --port 8080       # Custom port
node agent/bin/cli.mjs --help            # Help
```

### Client

```bash
node client/bin/cli.mjs                  # Start client (default: port 9877)
node client/bin/cli.mjs --port 3000      # Custom port
node client/bin/cli.mjs --help           # Help
```

## Two Execution Modes

| | Approval Mode (Default) | Auto-execute Mode |
|---|---|---|
| Security | AI commands require manual approval | Commands execute immediately |
| Best for | Getting started, less trust in AI | Familiar workflow, trusted AI |
| Switch via | Dashboard → Settings | Dashboard → Settings |

## Configuration

**Agent config**: `~/.secure-deployer/config.json`

```json
{
  "apiPort": 9876,
  "executionMode": "approval",
  "commandBlacklist": ["rm -rf /", "shutdown", "reboot"],
  "rateLimit": { "windowMs": 60000, "max": 60 }
}
```

**Client config**: `~/.secure-deployer/client-config.json`

```json
{
  "dashPort": 9877,
  "servers": [
    { "name": "prod", "host": "10.0.1.5", "port": 9876, "managementSecret": "ms-..." }
  ]
}
```

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript + Vite + TailwindCSS

## Security Recommendations

1. Use a strong dashboard password
2. Restrict Agent port access with a firewall — only allow your Client IP
3. Start with approval mode; switch to auto-execute after gaining confidence
4. Review operation history regularly
5. Rotate keys periodically with `agent rotate-keys`

## Author

**Chase Dai** — [GitHub](https://github.com/chasedai) · [Email](mailto:chasedai@qq.com)

## License

[CC BY-NC 4.0](./LICENSE) — Free to use and modify with attribution. Not for commercial use.
