<div align="center">

# 🛡️ Secure Deployer

**Let AI manage your server — secure remote command execution & management tool**

English | [简体中文](./README_CN.md)

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-blue)]()
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen)]()

</div>

---

![Dashboard](./screenshots/dashboard.png)

## What is this?

Secure Deployer runs a lightweight service on your remote server, enabling AI applications (Cursor, openClaw etc.) to execute commands, manage files, and deploy projects on your behalf.

**Problems it solves:**

- AI applications refuse to handle server credentials or SSH connections → Secure Deployer bridges the gap so AI can operate your server freely
- VPN causes unstable SSH connections → Secure Deployer uses short-lived connections that are inherently more stable
- Worried about AI messing up your server → Default approval mode requires your explicit approval for every command
- Non-technical users can't understand shell commands → AI must provide a natural language description with every command

## Key Features

**🔒 Security First**
- Default approval mode: every AI command requires manual approval in the dashboard
- AI must describe the purpose and risks of every command in natural language
- Dangerous commands are automatically blocked + real-time alert notifications (configurable blacklist)
- Dual-port isolation: AI API and management dashboard on separate ports

![Security Alerts](./screenshots/block-commands.png)

**⚡ Full Featured**
- Command execution (synchronous + streaming output)
- File management (browse, edit, upload, download)
- System monitoring (CPU / memory / disk)
- Operation history + visual statistics
- One-click Skill document generation

![Skill Generator](./screenshots/skill-generator.png)

**🌐 User Friendly**
- Web-based visual management dashboard
- Bilingual interface (English / 中文)
- One-click installation script
- Easy enough for non-technical users

## Quick Start

### Install on Server

```bash
# One-click install (requires root)
curl -fsSL https://raw.githubusercontent.com/chasedai/secure-deployer/main/scripts/install.sh | sudo bash
```

Or install manually:

```bash
git clone https://github.com/chasedai/secure-deployer.git
cd secure-deployer
npm install
npm run build
npm start
```

### Usage

1. **Open the dashboard**: Visit `http://YOUR_SERVER_IP:9877` in your browser and set an admin password
2. **Generate a Skill document**: Go to "Skill Gen" page, enter your server address, and click Generate
3. **Provide it to your AI application**: openClaw, Cursor, Claude, or any AI application
4. **Start working**: AI calls the API according to the document. You approve commands in the dashboard.

## Architecture

![Architecture](./screenshots/architecture.jpg)

**Dual-port design:**
- `9876` (AI API): API Key authentication, for AI application access
- `9877` (Dashboard): Password authentication, for human management

## Two Execution Modes

| | Approval Mode (Default) | Auto-execute Mode |
|---|---|---|
| Security | AI commands require manual approval | Commands execute immediately |
| Best for | Getting started, less trust in AI | Familiar workflow, trusted AI |
| Switch via | Dashboard → Settings | Dashboard → Settings |

## Dashboard

- **Overview**: Server resource dashboard with activity trend charts
- **Approval Center**: Review AI-submitted commands + security alert notifications
- **Terminal**: Execute commands manually
- **File Manager**: Browse and edit files
- **History**: Timeline of all operations
- **Settings**: Mode switching, API Key management, security configuration
- **Skill Gen**: One-click AI integration document generation

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Process Management**: PM2

## Configuration

Config file is located at `~/.secure-deployer/config.json`. You can modify it through the dashboard or edit directly:

```json
{
  "apiPort": 9876,
  "dashPort": 9877,
  "executionMode": "approval",
  "commandBlacklist": ["rm -rf /", "shutdown", "reboot", "dd if=", "mkfs"],
  "rateLimit": { "windowMs": 60000, "max": 60 }
}
```

## Security Recommendations

1. Use a strong password for the dashboard
2. Restrict dashboard port (9877) access via firewall
3. Start with approval mode; switch to auto-execute only after gaining confidence
4. Review operation history regularly
5. Consider setting up HTTPS via an nginx reverse proxy

## Author

**Chase Dai** — [GitHub](https://github.com/chasedai) · [Email](mailto:chasedai@qq.com)

## License

[CC BY-NC 4.0](./LICENSE) — Free to use and modify with attribution. Not for commercial use.
