import { useState, useEffect } from "react";
import { History as HistoryIcon, Terminal, FileText, Trash2, Upload, Filter } from "lucide-react";
import { getHistory, type HistoryEntry } from "../lib/api";
import { timeAgo, statusLabel, taskTypeLabel, formatDuration } from "../lib/utils";
import { useI18n } from "../lib/i18n";

export default function HistoryPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => { loadHistory(); }, [typeFilter]);
  const loadHistory = async () => { setLoading(true); try { const data = await getHistory({ type: typeFilter || undefined, limit: 100 }); setEntries(data.entries); setTotal(data.total); if (data.entries.length > 0 && !selected) setSelected(data.entries[0]); } catch {} finally { setLoading(false); } };

  const typeIcon = (type: string) => ({ exec: <Terminal size={14} />, file_write: <FileText size={14} />, file_delete: <Trash2 size={14} />, file_upload: <Upload size={14} /> }[type] || <Terminal size={14} />);

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <HistoryIcon size={22} style={{ color: "#af52de" }} />
        <h2 className="text-2xl font-bold">{t("history.title")}</h2>
        <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{t("history.total", total)}</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Filter size={15} style={{ color: "var(--text-tertiary)" }} />
        {["", "exec", "file_write", "file_delete"].map((tp) => (
          <button key={tp} onClick={() => { setTypeFilter(tp); setSelected(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${typeFilter === tp ? "text-white" : ""}`}
            style={typeFilter === tp ? { background: "var(--accent)" } : { color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border-light)" }}>
            {tp === "" ? t("history.all") : taskTypeLabel(tp, t)}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="w-[420px] flex-shrink-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>
            : entries.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.noData")}</div>
            : entries.map((entry) => {
              const st = statusLabel(entry.status, t);
              return (
                <div key={entry.id} className="px-4 py-3 cursor-pointer transition-colors" style={{ background: selected?.id === entry.id ? "var(--accent-light)" : "transparent", borderBottom: "1px solid var(--border-light)" }} onClick={() => setSelected(entry)}>
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: "var(--text-secondary)" }}>{typeIcon(entry.type)}</span>
                    <span className="text-sm flex-1 truncate font-mono">{entry.type === "exec" ? (entry.request?.cmd as string)?.slice(0, 60) : `${taskTypeLabel(entry.type, t)}: ${(entry.request?.path as string)?.split("/").pop() || ""}`}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 ml-6">
                    <span className={`text-[11px] font-medium ${st.color}`}>{st.text}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{timeAgo(entry.timestamp, t)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex-1 rounded-2xl overflow-y-auto" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
          {selected ? (
            <div className="p-6">
              {selected.description && (
                <div className="mb-5 p-4 rounded-xl" style={{ background: "var(--accent-light)" }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--accent)" }}>{t("history.aiDesc")}</p>
                  <p className="text-sm leading-relaxed">{selected.description}</p>
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusLabel(selected.status, t).color}`} style={{ background: selected.status === "completed" ? "var(--success-light)" : selected.status === "rejected" || selected.status === "blocked" ? "var(--danger-light)" : "var(--warning-light)" }}>{statusLabel(selected.status, t).text}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{taskTypeLabel(selected.type, t)}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{new Date(selected.timestamp).toLocaleString()}</span>
              </div>
              {selected.type === "exec" && selected.request?.cmd && <div className="mb-4"><p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{t("history.command")}</p><pre className="p-3 rounded-xl text-sm overflow-x-auto" style={{ background: "var(--bg-primary)" }}><code>{selected.request.cmd as string}</code></pre></div>}
              {selected.result && (
                <div className="mb-4">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{t("history.result")} {selected.result.exitCode !== undefined && <span className="ml-2 font-mono">exit {String(selected.result.exitCode)}</span>}{selected.result.duration && <span className="ml-2">{formatDuration(selected.result.duration as number)}</span>}</p>
                  {(selected.result.stdout as string) && <pre className="p-3 rounded-xl text-xs max-h-60 overflow-auto leading-5" style={{ background: "var(--bg-primary)" }}>{(selected.result.stdout as string).slice(0, 3000)}</pre>}
                  {(selected.result.stderr as string) && <pre className="p-3 rounded-xl text-xs max-h-40 overflow-auto leading-5 mt-2" style={{ background: "#fff8ec", color: "#7a4510" }}>{(selected.result.stderr as string).slice(0, 3000)}</pre>}
                </div>
              )}
              {selected.rejectReason && <div className="p-3 rounded-xl" style={{ background: "var(--danger-light)" }}><p className="text-xs font-medium mb-1" style={{ color: "var(--danger)" }}>{t("history.rejectReason")}</p><p className="text-sm">{selected.rejectReason}</p></div>}
            </div>
          ) : <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-tertiary)" }}>{t("history.selectHint")}</div>}
        </div>
      </div>
    </div>
  );
}
