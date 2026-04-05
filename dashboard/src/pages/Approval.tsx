import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Check, X, Clock, Terminal, FileText, Trash2, Upload, AlertTriangle, ShieldOff } from "lucide-react";
import { getPendingTasks, approveTask, rejectTask, connectSSE, getAlerts, markAlertsRead, type Task, type Alert } from "../lib/api";
import { timeAgo, taskTypeLabel } from "../lib/utils";
import { useI18n } from "../lib/i18n";

interface Props { onCountChange: (count: number) => void; onAlertCountChange: (count: number) => void; }

export default function Approval({ onCountChange, onAlertCountChange }: Props) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState<"pending" | "alerts">("pending");

  const loadTasks = useCallback(async () => {
    try { const { tasks: p } = await getPendingTasks(); setTasks(p); onCountChange(p.length); } catch {} finally { setLoading(false); }
  }, [onCountChange]);

  const loadAlerts = useCallback(async () => {
    try { const data = await getAlerts(); setAlerts(data.alerts); onAlertCountChange(data.unread); } catch {}
  }, [onAlertCountChange]);

  useEffect(() => {
    loadTasks(); loadAlerts();
    const es = connectSSE((ev) => {
      if (ev === "new_task" || ev === "task_updated") loadTasks();
      if (ev === "command_blocked") loadAlerts();
    });
    return () => es.close();
  }, [loadTasks, loadAlerts]);

  const handleApprove = async (id: string) => { setActionLoading(id); try { await approveTask(id); setTasks((p) => p.filter((t2) => t2.id !== id)); onCountChange(Math.max(0, tasks.length - 1)); } catch {} finally { setActionLoading(null); } };
  const handleReject = async (id: string) => { setActionLoading(id); try { await rejectTask(id, rejectReason); setTasks((p) => p.filter((t2) => t2.id !== id)); onCountChange(Math.max(0, tasks.length - 1)); setRejectingId(null); setRejectReason(""); } catch {} finally { setActionLoading(null); } };
  const handleMarkRead = async () => { try { await markAlertsRead(); onAlertCountChange(0); setAlerts((a) => a.map((x) => ({ ...x, read: true }))); } catch {} };

  const typeIcon = (type: string) => {
    const m: Record<string, React.ReactNode> = { exec: <Terminal size={16} />, file_write: <FileText size={16} />, file_delete: <Trash2 size={16} />, file_upload: <Upload size={16} /> };
    return m[type] || <Terminal size={16} />;
  };

  const unreadAlerts = alerts.filter((a) => !a.read).length;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={24} style={{ color: "var(--accent)" }} />
        <h2 className="text-2xl font-bold">{t("approval.title")}</h2>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setTab("pending")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors" style={tab === "pending" ? { background: "var(--accent)", color: "#fff" } : { background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
          <ShieldCheck size={15} /> {t("approval.title")}
          {tasks.length > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: tab === "pending" ? "rgba(255,255,255,0.3)" : "var(--accent-light)", color: tab === "pending" ? "#fff" : "var(--accent)" }}>{tasks.length}</span>}
        </button>
        <button onClick={() => setTab("alerts")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors" style={tab === "alerts" ? { background: "var(--danger)", color: "#fff" } : { background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
          <AlertTriangle size={15} /> {t("alert.title")}
          {unreadAlerts > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: tab === "alerts" ? "rgba(255,255,255,0.3)" : "var(--danger-light)", color: tab === "alerts" ? "#fff" : "var(--danger)" }}>{unreadAlerts}</span>}
        </button>
      </div>

      {tab === "pending" ? (
        loading ? <div className="text-center py-20" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>
        : tasks.length === 0 ? (
          <div className="text-center py-20">
            <ShieldCheck size={48} className="mx-auto mb-4" style={{ color: "#34c75950" }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("approval.empty")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t("approval.emptyHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <div className="p-1.5 rounded-lg" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>{typeIcon(task.type)}</div>
                  <span className="text-sm font-medium">{taskTypeLabel(task.type, t)}</span>
                  <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}><Clock size={12} /> {timeAgo(task.createdAt, t)}</span>
                </div>
                <div className="px-5 py-4" style={{ background: "var(--accent-light)" }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--accent)" }}>{t("approval.aiDesc")}</p>
                  <p className="text-sm leading-relaxed">{task.description}</p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>{task.type === "exec" ? t("approval.command") : t("approval.detail")}</p>
                  <pre className="text-sm p-3 rounded-xl overflow-x-auto" style={{ background: "var(--bg-primary)" }}><code>{task.type === "exec" ? (task.request.cmd as string) : JSON.stringify(task.request, null, 2)}</code></pre>
                  {task.request.cwd && <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>{t("approval.cwd")}: <code>{task.request.cwd as string}</code></p>}
                </div>
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--border-light)" }}>
                  {rejectingId === task.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" placeholder={t("approval.rejectReason")} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1 text-sm" autoFocus />
                      <button onClick={() => handleReject(task.id)} disabled={actionLoading === task.id} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--danger)" }}>{t("approval.confirmReject")}</button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="px-3 py-2 rounded-xl text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>{t("common.cancel")}</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleApprove(task.id)} disabled={actionLoading === task.id} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--success)" }}>
                        <Check size={16} /> {actionLoading === task.id ? t("approval.executing") : t("approval.approve")}
                      </button>
                      <button onClick={() => setRejectingId(task.id)} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ color: "var(--danger)" }}>
                        <X size={16} /> {t("approval.reject")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        alerts.length === 0 ? (
          <div className="text-center py-20">
            <ShieldOff size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("alert.empty")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t("alert.emptyHint")}</p>
          </div>
        ) : (
          <div>
            {unreadAlerts > 0 && (
              <div className="mb-4 flex justify-end">
                <button onClick={handleMarkRead} className="text-sm font-medium px-4 py-2 rounded-xl cursor-pointer" style={{ color: "var(--accent)", background: "var(--accent-light)" }}>{t("alert.markRead")}</button>
              </div>
            )}
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: `1px solid ${alert.read ? "var(--border-light)" : "var(--danger)"}` }}>
                  <div className="px-5 py-3 flex items-center gap-3" style={{ background: alert.read ? "transparent" : "var(--danger-light)", borderBottom: "1px solid var(--border-light)" }}>
                    <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--danger)" }}>{t("alert.blocked")}</span>
                    {!alert.read && <span className="w-2 h-2 rounded-full" style={{ background: "var(--danger)" }} />}
                    <span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>{timeAgo(alert.timestamp, t)}</span>
                  </div>
                  {alert.description && (
                    <div className="px-5 py-3" style={{ background: "var(--warning-light)" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--warning)" }}>{t("approval.aiDesc")}</p>
                      <p className="text-sm">{alert.description}</p>
                    </div>
                  )}
                  <div className="px-5 py-3">
                    <p className="text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("approval.command")}</p>
                    <pre className="text-sm p-3 rounded-xl overflow-x-auto" style={{ background: "var(--bg-primary)" }}><code>{alert.cmd}</code></pre>
                    <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      <span className="font-medium">{t("alert.matchedRules")}:</span>
                      {alert.matchedPatterns.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-md font-mono" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
