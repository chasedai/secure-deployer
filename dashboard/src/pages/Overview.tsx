import { useState, useEffect } from "react";
import { Cpu, HardDrive, MemoryStick, Clock, Server, Activity, TrendingUp, PieChart as PieIcon } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { getAgentConfig, getStats, getSystemInfo, type AgentConfig, type Stats, type SystemInfo } from "../lib/api";
import { formatBytes, taskTypeLabel, timeAgo } from "../lib/utils";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";

const PIE_COLORS = ["#0071e3", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa"];

export default function Overview() {
  const { t } = useI18n();
  const { selectedId } = useServer();
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!selectedId) { setSys(null); setConfig(null); setStats(null); return; }
    const load = async () => {
      try {
        const [sysRes, cfgRes, statsRes] = await Promise.all([getSystemInfo(selectedId), getAgentConfig(selectedId), getStats(selectedId)]);
        setSys(sysRes); setConfig(cfgRes); setStats(statsRes);
      } catch {}
    };
    load(); const timer = setInterval(load, 15_000); return () => clearInterval(timer);
  }, [selectedId]);

  if (!selectedId) return <NoServer t={t} />;

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}${t("overview.day")} ${h}${t("overview.hour")} ${m}${t("overview.min")}` : h > 0 ? `${h}${t("overview.hour")} ${m}${t("overview.min")}` : `${m}${t("overview.min")}`;
  };
  const pieData = stats?.typeDistribution.map((d) => ({ name: taskTypeLabel(d.type, t), value: d.count })) || [];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">{t("overview.title")}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={<Cpu size={20} />} label={t("overview.cpu")} value={sys ? `${sys.cpu.usage}%` : "--"} sub={sys?.cpu.model?.split(" ").slice(0, 3).join(" ") || ""} percent={sys?.cpu.usage} color="#0071e3" />
        <MetricCard icon={<MemoryStick size={20} />} label={t("overview.memory")} value={sys ? `${sys.memory.usagePercent}%` : "--"} sub={sys ? `${formatBytes(sys.memory.used)} / ${formatBytes(sys.memory.total)}` : ""} percent={sys?.memory.usagePercent} color="#af52de" />
        <MetricCard icon={<HardDrive size={20} />} label={t("overview.disk")} value={sys?.disk[0]?.usagePercent || "--"} sub={sys?.disk[0] ? `${sys.disk[0].used} / ${sys.disk[0].size}` : ""} percent={sys?.disk[0] ? parseInt(sys.disk[0].usagePercent) : undefined} color="#ff9500" />
        <MetricCard icon={<Clock size={20} />} label={t("overview.uptime")} value={sys ? formatUptime(sys.uptime) : "--"} sub={sys?.hostname || ""} color="#34c759" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={18} style={{ color: "var(--accent)" }} /><span className="font-semibold text-sm">{t("overview.trend")}</span><span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>{t("overview.totalOps", stats?.total || 0)}</span></div>
          <div className="h-52">{stats && stats.dailyCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.dailyCounts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0071e3" stopOpacity={0.2} /><stop offset="100%" stopColor="#0071e3" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e8e8ed", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v: number) => [`${v}`, t("overview.opsCount")]} /><Area type="monotone" dataKey="count" stroke="#0071e3" strokeWidth={2} fill="url(#areaFill)" /></AreaChart></ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.noData")}</div>}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-4"><PieIcon size={18} style={{ color: "#af52de" }} /><span className="font-semibold text-sm">{t("overview.typeDist")}</span></div>
          {pieData.length > 0 ? (<><div className="h-40 flex items-center justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e8e8ed", borderRadius: 8, fontSize: 13 }} /></PieChart></ResponsiveContainer></div><div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">{pieData.map((d, i) => (<div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{d.name}</div>))}</div></>) : <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.noData")}</div>}
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><div className="flex items-center gap-2 mb-4"><Server size={18} style={{ color: "var(--text-secondary)" }} /><span className="font-semibold text-sm">{t("overview.sysInfo")}</span></div>{sys ? (<div className="space-y-3 text-sm"><InfoRow label={t("overview.hostname")} value={sys.hostname} /><InfoRow label={t("overview.system")} value={`${sys.platform} ${sys.release}`} /><InfoRow label={t("overview.arch")} value={sys.arch} /><InfoRow label={t("overview.cpuCores")} value={t("overview.cores", sys.cpu.cores)} /></div>) : <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</p>}</Card>
        <Card><div className="flex items-center gap-2 mb-4"><Activity size={18} style={{ color: "var(--text-secondary)" }} /><span className="font-semibold text-sm">{t("overview.agentConfig")}</span></div>{config ? (<div className="space-y-3 text-sm"><InfoRow label={t("overview.execMode")} value={config.executionMode === "approval" ? t("overview.modeApproval") : t("overview.modeAuto")} /><InfoRow label={t("overview.apiPort")} value={String(config.apiPort)} /><InfoRow label={t("overview.rateLimit")} value={t("overview.rateFmt", config.rateLimit.max, config.rateLimit.windowMs / 1000)} /></div>) : <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</p>}</Card>
        <Card><div className="flex items-center gap-2 mb-4"><Clock size={18} style={{ color: "var(--text-secondary)" }} /><span className="font-semibold text-sm">{t("overview.recent")}</span></div>{stats?.recent && stats.recent.length > 0 ? (<div className="space-y-2.5">{stats.recent.map((r) => (<div key={r.id} className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: r.status === "completed" ? "var(--success)" : r.status === "rejected" ? "var(--danger)" : "var(--warning)" }} /><div className="flex-1 min-w-0"><p className="text-xs truncate font-mono">{r.type === "exec" ? (r.request?.cmd as string)?.slice(0, 50) : taskTypeLabel(r.type, t)}</p><p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{timeAgo(r.timestamp, t)}</p></div></div>))}</div>) : <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>{t("overview.noRecords")}</div>}</Card>
      </div>
    </div>
  );
}

function NoServer({ t }: { t: (k: string) => string }) {
  return <div className="flex items-center justify-center h-full"><div className="text-center"><Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} /><p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.selectHint")}</p><p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t("servers.selectHintLong")}</p></div></div>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl p-5 ${className}`} style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>{children}</div>;
}
function MetricCard({ icon, label, value, sub, percent, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; percent?: number }) {
  return (<Card><div className="flex items-center gap-2.5 mb-3"><div className="p-2 rounded-xl" style={{ background: `${color}12`, color }}>{icon}</div><span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span></div><div className="text-2xl font-bold mb-0.5">{value}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sub}</div>{percent !== undefined && <div className="mt-3 h-1.5 rounded-full" style={{ background: "var(--bg-primary)" }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percent, 100)}%`, background: color }} /></div>}</Card>);
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between items-center"><span style={{ color: "var(--text-secondary)" }}>{label}</span><span className="font-mono text-xs">{value}</span></div>;
}
