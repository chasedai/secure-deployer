import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Key, Shield, Eye, EyeOff, RefreshCw, Save, AlertTriangle, Copy, Check, Server } from "lucide-react";
import { getAgentConfig, updateAgentConfig, regenerateKey, changePassword, type AgentConfig } from "../lib/api";
import { copyToClipboard } from "../lib/utils";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";

export default function SettingsPage() {
  const { t } = useI18n();
  const { selectedId } = useServer();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPw, setCurrentPw] = useState(""); const [newPw, setNewPw] = useState("");
  const [blacklistText, setBlacklistText] = useState("");

  useEffect(() => {
    if (!selectedId) { setLoading(false); return; }
    getAgentConfig(selectedId).then((c) => { setConfig(c); setBlacklistText(c.commandBlacklist.join("\n")); }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedId]);

  if (!selectedId) return <div className="flex items-center justify-center h-full"><div className="text-center"><Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} /><p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.selectHint")}</p></div></div>;

  const flash = (type: "success" | "error", text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };
  const handleModeSwitch = async (mode: "approval" | "auto") => { try { const { config: c } = await updateAgentConfig(selectedId, { executionMode: mode }); setConfig(c); flash("success", t("settings.switchedTo", mode === "approval" ? t("settings.modeApproval") : t("settings.modeAuto"))); } catch (err: unknown) { flash("error", err instanceof Error ? err.message : "Error"); } };
  const handleRegenKey = async () => { if (!confirm(t("settings.regenerateConfirm"))) return; try { const { apiKey } = await regenerateKey(selectedId); setConfig((c) => c ? { ...c, apiKey } : c); flash("success", t("settings.keyUpdated")); } catch (err: unknown) { flash("error", err instanceof Error ? err.message : "Error"); } };
  const handleCopyKey = async () => { if (!config) return; const ok = await copyToClipboard(config.apiKey); if (ok) { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); } };
  const handleChangePw = async () => { if (newPw.length < 4) { flash("error", t("settings.pwTooShort")); return; } try { await changePassword(currentPw, newPw); setCurrentPw(""); setNewPw(""); flash("success", t("settings.pwUpdated")); } catch (err: unknown) { flash("error", err instanceof Error ? err.message : "Error"); } };
  const handleSaveBlacklist = async () => { const list = blacklistText.split("\n").map((s) => s.trim()).filter(Boolean); try { const { config: c } = await updateAgentConfig(selectedId, { commandBlacklist: list }); setConfig(c); flash("success", t("settings.blacklistUpdated")); } catch (err: unknown) { flash("error", err instanceof Error ? err.message : "Error"); } };

  if (loading || !config) return <div className="p-8" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6"><SettingsIcon size={22} style={{ color: "var(--text-secondary)" }} /><h2 className="text-2xl font-bold">{t("settings.title")}</h2></div>
      {msg && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: msg.type === "success" ? "var(--success-light)" : "var(--danger-light)", color: msg.type === "success" ? "var(--success)" : "var(--danger)" }}>{msg.text}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title={t("settings.execMode")} icon={<Shield size={18} />}><p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{t("settings.execModeDesc")}</p><div className="flex gap-3">{(["approval", "auto"] as const).map((mode) => (<button key={mode} onClick={() => handleModeSwitch(mode)} className="flex-1 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all" style={config.executionMode === mode ? { background: "var(--accent)", color: "#fff" } : { background: "var(--bg-primary)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>{mode === "approval" ? t("settings.modeApproval") : t("settings.modeAuto")}</button>))}</div>{config.executionMode === "auto" && <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: "var(--warning)" }}><AlertTriangle size={14} /> {t("settings.autoWarning")}</div>}</Section>
        <Section title={t("settings.apiKey")} icon={<Key size={18} />}><div className="flex items-center gap-2"><div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-sm" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)" }}><span className="flex-1 truncate">{showKey ? config.apiKey : "••••••••••••••••••••"}</span><button onClick={() => setShowKey(!showKey)} className="p-1 rounded cursor-pointer" style={{ color: "var(--text-tertiary)" }}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button><button onClick={handleCopyKey} className="p-1 rounded cursor-pointer" style={{ color: "var(--text-tertiary)" }}>{keyCopied ? <Check size={14} style={{ color: "var(--success)" }} /> : <Copy size={14} />}</button></div><button onClick={handleRegenKey} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm cursor-pointer" style={{ border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}><RefreshCw size={14} /> {t("settings.regenerate")}</button></div></Section>
        <Section title={t("settings.password")} icon={<Shield size={18} />}><div className="space-y-3"><input type="password" placeholder={t("settings.currentPw")} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="w-full" /><input type="password" placeholder={t("settings.newPw")} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full" /><button onClick={handleChangePw} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>{t("settings.changePw")}</button></div></Section>
        <Section title={t("settings.blacklist")} icon={<AlertTriangle size={18} />}><p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{t("settings.blacklistDesc")}</p><textarea value={blacklistText} onChange={(e) => setBlacklistText(e.target.value)} rows={6} className="w-full font-mono text-sm" /><button onClick={handleSaveBlacklist} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}><Save size={14} /> {t("common.save")}</button></Section>
      </div>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return (<div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}><div className="flex items-center gap-2 mb-4 font-semibold text-sm"><span style={{ color: "var(--text-secondary)" }}>{icon}</span><span>{title}</span></div>{children}</div>); }
