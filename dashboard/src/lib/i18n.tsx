import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Lang = "zh" | "en";

const dict: Record<Lang, Record<string, string>> = {
  zh: {
    "nav.overview": "概览",
    "nav.approval": "审批中心",
    "nav.terminal": "终端",
    "nav.files": "文件管理",
    "nav.history": "操作历史",
    "nav.settings": "设置",
    "nav.skill": "Skill 生成",
    "nav.subtitle": "远程服务器管理",

    "common.loading": "加载中...",
    "common.noData": "暂无数据",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.copy": "复制",
    "common.copied": "已复制",
    "common.download": "下载",
    "common.confirm": "确认",
    "common.delete": "删除",
    "common.refresh": "刷新",
    "common.parentDir": "上级目录",
    "common.emptyDir": "空目录",

    "login.title": "Secure Deployer",
    "login.setup": "首次使用，请设置管理密码",
    "login.prompt": "请输入管理密码",
    "login.password": "输入密码",
    "login.confirm": "确认密码",
    "login.mismatch": "两次输入的密码不一致",
    "login.tooShort": "密码至少 4 个字符",
    "login.setupBtn": "设置密码并进入",
    "login.loginBtn": "登录",
    "login.processing": "处理中...",

    "overview.title": "服务器概览",
    "overview.cpu": "CPU 使用率",
    "overview.memory": "内存使用",
    "overview.disk": "磁盘使用",
    "overview.uptime": "运行时间",
    "overview.trend": "操作趋势（近 14 天）",
    "overview.totalOps": "共 {0} 次操作",
    "overview.opsCount": "操作数",
    "overview.typeDist": "操作类型分布",
    "overview.sysInfo": "系统信息",
    "overview.hostname": "主机名",
    "overview.system": "系统",
    "overview.arch": "架构",
    "overview.cpuCores": "CPU 核心",
    "overview.cores": "{0} 核",
    "overview.agentConfig": "Agent 配置",
    "overview.execMode": "执行模式",
    "overview.modeApproval": "审批模式",
    "overview.modeAuto": "直接执行",
    "overview.apiPort": "API 端口",
    "overview.dashPort": "Dashboard",
    "overview.rateLimit": "速率限制",
    "overview.rateFmt": "{0} 次/{1}秒",
    "overview.recent": "最近操作",
    "overview.noRecords": "暂无记录",
    "overview.day": "天",
    "overview.hour": "时",
    "overview.min": "分",

    "approval.title": "审批中心",
    "approval.pending": "{0} 条待审批",
    "approval.empty": "没有待审批的任务",
    "approval.emptyHint": "当 AI 提交新请求时，会在这里显示",
    "approval.aiDesc": "AI 说明",
    "approval.command": "命令",
    "approval.detail": "操作详情",
    "approval.cwd": "工作目录",
    "approval.approve": "批准执行",
    "approval.executing": "执行中...",
    "approval.reject": "拒绝",
    "approval.rejectReason": "拒绝原因（可选）",
    "approval.confirmReject": "确认拒绝",

    "terminal.title": "终端",
    "terminal.ready": "终端就绪。输入命令开始操作。",
    "terminal.cwd": "工作目录",
    "terminal.placeholder": "输入命令...",
    "terminal.running": "执行中...",
    "terminal.approvalHint": "任务已提交 ({0})，当前为审批模式。请在审批中心批准。",

    "files.title": "文件管理",
    "files.save": "保存",
    "files.saving": "保存中...",

    "history.title": "操作历史",
    "history.total": "共 {0} 条",
    "history.all": "全部",
    "history.selectHint": "选择左侧记录查看详情",
    "history.aiDesc": "AI 说明",
    "history.command": "命令",
    "history.result": "执行结果",
    "history.rejectReason": "拒绝原因",

    "settings.title": "设置",
    "settings.execMode": "执行模式",
    "settings.execModeDesc": "审批模式下 AI 的命令需要你手动批准才会执行；直接执行模式则跳过审批。",
    "settings.modeApproval": "审批模式（推荐）",
    "settings.modeAuto": "直接执行模式",
    "settings.autoWarning": "当前为直接执行模式，AI 的命令将不经审批直接执行",
    "settings.apiKey": "API Key",
    "settings.regenerate": "重新生成",
    "settings.regenerateConfirm": "重新生成 API Key 后，现有的 AI 连接将失效。确定继续？",
    "settings.keyUpdated": "API Key 已更新",
    "settings.password": "管理密码",
    "settings.currentPw": "当前密码",
    "settings.newPw": "新密码",
    "settings.changePw": "修改密码",
    "settings.pwUpdated": "密码已更新",
    "settings.pwTooShort": "新密码至少 4 个字符",
    "settings.blacklist": "命令黑名单",
    "settings.blacklistDesc": "包含以下关键词的命令会被自动拦截（每行一个）",
    "settings.blacklistUpdated": "黑名单已更新",
    "settings.switchedTo": "已切换为{0}",

    "skill.title": "Skill 文档生成器",
    "skill.desc": "生成一份 Markdown 文档，包含所有 API 接口说明。将文档提供给 AI 模型，它就能自主操作你的服务器。",
    "skill.config": "配置信息",
    "skill.serverAddr": "服务器公网地址",
    "skill.serverAddrHint": "AI 模型将通过此地址访问你的服务器",
    "skill.serverAddrPlaceholder": "例如: 123.45.67.89 或 your-server.com",
    "skill.extraNotes": "补充说明（可选）",
    "skill.extraNotesPlaceholder": "例如: 这是一个 Next.js 项目，代码在 /home/ubuntu/myapp 目录下...",
    "skill.generate": "生成 Skill 文档",
    "skill.generating": "生成中...",
    "skill.preview": "预览",
    "skill.previewHint": "填入服务器地址后点击「生成 Skill 文档」，预览将显示在这里",
    "skill.downloadMd": "下载 .md",
    "skill.usage": "使用方式",
    "skill.usagePrep": "准备工作",
    "skill.usageStep1": "填入服务器公网地址，点击「生成」",
    "skill.usageStep2": "确保服务器防火墙已开放 {0} 端口",
    "skill.usageStep3": "点击「下载 .md」保存文件",
    "skill.usageOC": "openClaw 接入",
    "skill.usageOCStep1": "创建 Skill 目录：",
    "skill.usageOCStep2": "将下载的文件重命名为 {0} 并放入该目录",
    "skill.usageOCStep3": "在 openClaw 中输入 {0} 开启新会话即可加载",
    "skill.usageGeneric": "通用方法",
    "skill.usageGenericDesc": "直接将 .md 文件上传给任何 AI 模型，要求其按照文档中的说明调用 API 操作服务器即可。",

    "type.exec": "命令执行",
    "type.file_write": "文件写入",
    "type.file_delete": "文件删除",
    "type.file_upload": "文件上传",

    "status.pending_approval": "待审批",
    "status.approved": "已批准",
    "status.executing": "执行中",
    "status.completed": "已完成",
    "status.rejected": "已拒绝",
    "status.blocked": "已拦截",

    "alert.title": "安全告警",
    "alert.blocked": "危险命令被拦截",
    "alert.matchedRules": "触发规则",
    "alert.markRead": "全部已读",
    "alert.empty": "没有安全告警",
    "alert.emptyHint": "当 AI 尝试执行黑名单命令时，告警会显示在这里",

    "time.secAgo": "{0}秒前",
    "time.minAgo": "{0}分钟前",
    "time.hourAgo": "{0}小时前",
    "time.dayAgo": "{0}天前",
  },

  en: {
    "nav.overview": "Overview",
    "nav.approval": "Approval",
    "nav.terminal": "Terminal",
    "nav.files": "Files",
    "nav.history": "History",
    "nav.settings": "Settings",
    "nav.skill": "Skill Gen",
    "nav.subtitle": "Remote Server Manager",

    "common.loading": "Loading...",
    "common.noData": "No data",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.download": "Download",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.refresh": "Refresh",
    "common.parentDir": "Parent directory",
    "common.emptyDir": "Empty directory",

    "login.title": "Secure Deployer",
    "login.setup": "First time? Set your admin password",
    "login.prompt": "Enter admin password",
    "login.password": "Password",
    "login.confirm": "Confirm password",
    "login.mismatch": "Passwords do not match",
    "login.tooShort": "Password must be at least 4 characters",
    "login.setupBtn": "Set Password & Enter",
    "login.loginBtn": "Login",
    "login.processing": "Processing...",

    "overview.title": "Server Overview",
    "overview.cpu": "CPU Usage",
    "overview.memory": "Memory",
    "overview.disk": "Disk",
    "overview.uptime": "Uptime",
    "overview.trend": "Activity Trend (14 days)",
    "overview.totalOps": "{0} operations total",
    "overview.opsCount": "Operations",
    "overview.typeDist": "Operation Types",
    "overview.sysInfo": "System Info",
    "overview.hostname": "Hostname",
    "overview.system": "System",
    "overview.arch": "Architecture",
    "overview.cpuCores": "CPU Cores",
    "overview.cores": "{0} cores",
    "overview.agentConfig": "Agent Config",
    "overview.execMode": "Exec Mode",
    "overview.modeApproval": "Approval",
    "overview.modeAuto": "Auto-execute",
    "overview.apiPort": "API Port",
    "overview.dashPort": "Dashboard",
    "overview.rateLimit": "Rate Limit",
    "overview.rateFmt": "{0} req/{1}s",
    "overview.recent": "Recent Activity",
    "overview.noRecords": "No records",
    "overview.day": "d",
    "overview.hour": "h",
    "overview.min": "m",

    "approval.title": "Approval Center",
    "approval.pending": "{0} pending",
    "approval.empty": "No pending tasks",
    "approval.emptyHint": "Tasks submitted by AI will appear here",
    "approval.aiDesc": "AI Description",
    "approval.command": "Command",
    "approval.detail": "Details",
    "approval.cwd": "Working directory",
    "approval.approve": "Approve",
    "approval.executing": "Executing...",
    "approval.reject": "Reject",
    "approval.rejectReason": "Reason (optional)",
    "approval.confirmReject": "Confirm Reject",

    "terminal.title": "Terminal",
    "terminal.ready": "Terminal ready. Enter a command to begin.",
    "terminal.cwd": "Working directory",
    "terminal.placeholder": "Enter command...",
    "terminal.running": "Running...",
    "terminal.approvalHint": "Task submitted ({0}). In approval mode — approve it in Approval Center.",

    "files.title": "File Manager",
    "files.save": "Save",
    "files.saving": "Saving...",

    "history.title": "History",
    "history.total": "{0} records",
    "history.all": "All",
    "history.selectHint": "Select a record to view details",
    "history.aiDesc": "AI Description",
    "history.command": "Command",
    "history.result": "Result",
    "history.rejectReason": "Reject Reason",

    "settings.title": "Settings",
    "settings.execMode": "Execution Mode",
    "settings.execModeDesc": "In approval mode, AI commands require your manual approval. Auto-execute mode skips approval.",
    "settings.modeApproval": "Approval (Recommended)",
    "settings.modeAuto": "Auto-execute",
    "settings.autoWarning": "Auto-execute is on — AI commands run without approval",
    "settings.apiKey": "API Key",
    "settings.regenerate": "Regenerate",
    "settings.regenerateConfirm": "Regenerating the API Key will invalidate existing AI connections. Continue?",
    "settings.keyUpdated": "API Key updated",
    "settings.password": "Admin Password",
    "settings.currentPw": "Current password",
    "settings.newPw": "New password",
    "settings.changePw": "Change Password",
    "settings.pwUpdated": "Password updated",
    "settings.pwTooShort": "New password must be at least 4 characters",
    "settings.blacklist": "Command Blacklist",
    "settings.blacklistDesc": "Commands containing these keywords will be blocked (one per line)",
    "settings.blacklistUpdated": "Blacklist updated",
    "settings.switchedTo": "Switched to {0}",

    "skill.title": "Skill Document Generator",
    "skill.desc": "Generate a Markdown document with full API reference. Provide it to an AI model so it can operate your server autonomously.",
    "skill.config": "Configuration",
    "skill.serverAddr": "Server Public Address",
    "skill.serverAddrHint": "The AI model will access your server through this address",
    "skill.serverAddrPlaceholder": "e.g. 123.45.67.89 or your-server.com",
    "skill.extraNotes": "Extra Notes (optional)",
    "skill.extraNotesPlaceholder": "e.g. This is a Next.js project at /home/ubuntu/myapp...",
    "skill.generate": "Generate Skill Document",
    "skill.generating": "Generating...",
    "skill.preview": "Preview",
    "skill.previewHint": "Enter server address and click Generate to see the preview",
    "skill.downloadMd": "Download .md",
    "skill.usage": "Usage Guide",
    "skill.usagePrep": "Preparation",
    "skill.usageStep1": "Enter server address and click Generate",
    "skill.usageStep2": "Ensure port {0} is open in your firewall",
    "skill.usageStep3": "Click Download .md to save the file",
    "skill.usageOC": "openClaw Setup",
    "skill.usageOCStep1": "Create skill directory:",
    "skill.usageOCStep2": "Rename the downloaded file to {0} and place it in that directory",
    "skill.usageOCStep3": "Type {0} in openClaw to start a new session and load the skill",
    "skill.usageGeneric": "Generic Method",
    "skill.usageGenericDesc": "Upload the .md file to any AI model and ask it to follow the API instructions to operate your server.",

    "type.exec": "Command",
    "type.file_write": "File Write",
    "type.file_delete": "File Delete",
    "type.file_upload": "File Upload",

    "status.pending_approval": "Pending",
    "status.approved": "Approved",
    "status.executing": "Running",
    "status.completed": "Completed",
    "status.rejected": "Rejected",
    "status.blocked": "Blocked",

    "alert.title": "Security Alerts",
    "alert.blocked": "Dangerous command blocked",
    "alert.matchedRules": "Matched rules",
    "alert.markRead": "Mark all read",
    "alert.empty": "No security alerts",
    "alert.emptyHint": "Alerts will appear here when AI attempts to run blacklisted commands",

    "time.secAgo": "{0}s ago",
    "time.minAgo": "{0}m ago",
    "time.hourAgo": "{0}h ago",
    "time.dayAgo": "{0}d ago",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "zh",
  setLang: () => {},
  t: (k) => k,
});

function detectLang(): Lang {
  const saved = localStorage.getItem("sd_lang") as Lang | null;
  if (saved && (saved === "zh" || saved === "en")) return saved;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("sd_lang", l);
  }, []);

  const t = useCallback(
    (key: string, ...args: (string | number)[]) => {
      let str = dict[lang][key] ?? dict["zh"][key] ?? key;
      args.forEach((a, i) => {
        str = str.replace(`{${i}}`, String(a));
      });
      return str;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
