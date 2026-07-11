import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Play, Loader2, Server, AlertTriangle, Info, CheckCircle2, Clock, ExternalLink, Sparkles, Gauge } from "lucide-react";
import { getScan, startScan, type ScanResult, type RunningScan, type ScanFinding } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";

export default function SecurityScanPage() {
  const { t } = useI18n();
  const { selectedId, selected } = useServer();
  const navigate = useNavigate();
  const [latest, setLatest] = useState<ScanResult | null>(null);
  const [running, setRunning] = useState<RunningScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadScan = async () => {
    if (!selectedId) return;
    try {
      const r = await getScan(selectedId);
      setLatest(r.latest);
      setRunning(r.running);
      return r;
    } catch { return null; }
  };

  useEffect(() => {
    setLoading(true);
    setErr(null);
    loadScan().finally(() => setLoading(false));
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
  }, [selectedId]);

  useEffect(() => {
    if (running && !pollRef.current) {
      pollRef.current = window.setInterval(async () => {
        const r = await loadScan();
        if (r && !r.running) {
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        }
      }, 2000) as unknown as number;
    }
    if (!running && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [running]);

  const handleStart = async () => {
    if (!selectedId) return;
    setErr(null);
    try {
      const r = await startScan(selectedId);
      setRunning(r.running);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  };

  const handleFixWithAI = (finding: ScanFinding) => {
    const prompt = `请帮我修复这个 Lynis 安全审计告警：\n\n【ID】${finding.id}\n【描述】${finding.text}${finding.solution ? `\n【建议方案】${finding.solution}` : ""}${finding.url ? `\n【参考】${finding.url}` : ""}\n\n请先解释风险，再通过命令修复并验证修复效果。`;
    sessionStorage.setItem("sd_prefill_chat", prompt);
    navigate("/ai-chat");
  };

  if (!selectedId) return (
    <div className="flex items-center justify-center h-full"><div className="text-center"><Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} /><p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.selectHint")}</p></div></div>
  );

  if (loading) return <div className="p-8" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <ShieldAlert size={22} style={{ color: "#ff3b30" }} />
        <h2 className="text-2xl font-bold">{t("scan.title")}</h2>
      </div>
      <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t("scan.desc")}</p>
      <p className="text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>{selected?.name} · {selected?.host}:{selected?.port}</p>

      {err && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> {err}
        </div>
      )}

      {running ? <RunningBanner running={running} /> : (
        <div className="mb-5 flex items-center gap-3">
          <button onClick={handleStart} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>
            <Play size={15} /> {latest ? t("scan.rescan") : t("scan.start")}
          </button>
          {latest?.finishedAt && (
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {t("scan.lastScanAt")}: {new Date(latest.finishedAt).toLocaleString()}
              {latest.durationMs && <> · {t("scan.duration")}: {Math.round(latest.durationMs / 1000)}s</>}
            </span>
          )}
        </div>
      )}

      {!running && !latest && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
          <ShieldAlert size={42} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />
          <h3 className="text-base font-semibold mb-1">{t("scan.neverRun")}</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("scan.neverRunHint")}</p>
        </div>
      )}

      {latest?.status === "failed" && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--danger-light)", border: "1px solid #ffcccc" }}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} style={{ color: "var(--danger)" }} /><span className="font-semibold" style={{ color: "var(--danger)" }}>{t("scan.failed")}</span></div>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{latest.error}</p>
        </div>
      )}

      {latest?.status === "completed" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat icon={<Gauge size={16} />} label={t("scan.hardeningIndex")} value={latest.hardeningIndex != null ? `${latest.hardeningIndex}/100` : "—"} color={latest.hardeningIndex != null ? hardeningColor(latest.hardeningIndex) : "var(--text-primary)"} />
            <Stat icon={<CheckCircle2 size={16} />} label={t("scan.testsExecuted")} value={String(latest.testsExecuted || 0)} color="var(--text-primary)" />
            <Stat icon={<AlertTriangle size={16} />} label={t("scan.warnings")} value={String(latest.warnings?.length || 0)} color={latest.warnings?.length ? "var(--danger)" : "var(--success)"} />
            <Stat icon={<Info size={16} />} label={t("scan.suggestions")} value={String(latest.suggestions?.length || 0)} color={latest.suggestions?.length ? "var(--warning)" : "var(--success)"} />
          </div>

          <FindingsSection title={t("scan.warnings")} icon={<AlertTriangle size={16} style={{ color: "var(--danger)" }} />} items={latest.warnings || []} empty={t("scan.noWarnings")} onFix={handleFixWithAI} severity="warning" />
          <div className="h-4" />
          <FindingsSection title={t("scan.suggestions")} icon={<Info size={16} style={{ color: "var(--warning)" }} />} items={latest.suggestions || []} empty={t("scan.noSuggestions")} onFix={handleFixWithAI} severity="suggestion" />

          <div className="mt-6 rounded-2xl p-4 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}>
            <div className="flex items-center gap-2 mb-1.5 font-semibold"><Info size={14} style={{ color: "var(--text-tertiary)" }} /> {t("scan.aboutLynis")}</div>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs leading-relaxed">{t("scan.aboutLynisText")}</p>
          </div>
        </>
      )}
    </div>
  );
}

function hardeningColor(n: number) {
  if (n >= 80) return "var(--success)";
  if (n >= 60) return "var(--warning)";
  return "var(--danger)";
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>{icon}{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function RunningBanner({ running }: { running: RunningScan }) {
  const { t } = useI18n();
  const stepKey = `scan.step.${running.step}`;
  return (
    <div className="mb-5 rounded-2xl p-5" style={{ background: "var(--accent-light)", border: "1px solid #cfe2ff" }}>
      <div className="flex items-center gap-2 mb-2"><Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} /><span className="font-semibold text-sm" style={{ color: "var(--accent)" }}>{t("scan.running")} — {t(stepKey)}</span></div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,113,227,0.15)" }}>
        <div className="h-full transition-all" style={{ width: `${running.progress}%`, background: "var(--accent)" }} />
      </div>
      <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
        <Clock size={11} /> {Math.round((Date.now() - running.startedAt) / 1000)}s
      </p>
    </div>
  );
}

function FindingsSection({ title, icon, items, empty, onFix, severity }: { title: string; icon: React.ReactNode; items: ScanFinding[]; empty: string; onFix: (f: ScanFinding) => void; severity: "warning" | "suggestion" }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isWarning = severity === "warning";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
      <div className="px-5 py-3 flex items-center gap-2 font-semibold" style={{ borderBottom: items.length > 0 ? "1px solid var(--border-light)" : "none" }}>
        {icon} {title} <span className="text-xs font-normal" style={{ color: "var(--text-tertiary)" }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-sm flex items-center gap-2" style={{ color: "var(--success)" }}><CheckCircle2 size={14} /> {empty}</div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
          {items.map((f, i) => {
            const key = `${f.id}-${i}`;
            const open = expanded[key];
            return (
              <div key={key} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => setExpanded({ ...expanded, [key]: !open })} className="text-left w-full cursor-pointer">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: isWarning ? "var(--danger-light)" : "var(--warning-light)", color: isWarning ? "var(--danger)" : "var(--warning)" }}>{f.id}</span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{f.text}</p>
                    </button>
                    {open && (
                      <div className="mt-2 space-y-1.5 text-xs">
                        {f.solution && <div><span style={{ color: "var(--text-tertiary)" }}>Solution: </span><span>{f.solution}</span></div>}
                        {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: "var(--accent)" }}><ExternalLink size={11} /> {t("scan.learnMore")}</a>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onFix(f)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex-shrink-0" style={{ background: "#f3e5ff", color: "#af52de" }}>
                    <Sparkles size={11} /> {t("scan.fixWithAI")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
