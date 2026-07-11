import { useState, useEffect } from "react";
import { Sparkles, Save, Zap, AlertCircle, CheckCircle2, Eye, EyeOff, Link2, Key, Cpu, Sliders } from "lucide-react";
import { getAIConfig, updateAIConfig, testAIConfig, type AIConfig } from "../lib/api";
import { useI18n } from "../lib/i18n";

export default function AIConfigPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const { config: c, configured: ok } = await getAIConfig(); setConfig(c); setConfigured(ok); }
    catch {} finally { setLoading(false); }
  };

  const flash = (type: "success" | "error", text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload: Partial<AIConfig> = {
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim();
      const { config: c, configured: ok } = await updateAIConfig(payload);
      setConfig(c); setConfigured(ok); setApiKeyInput("");
      flash("success", t("ai.saved"));
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testAIConfig();
      if (res.ok) flash("success", `${t("ai.testOk")}${res.model ? ` — ${res.model}` : ""}`);
      else flash("error", `${t("ai.testFail")}: ${res.error}`);
    } catch (err) {
      flash("error", `${t("ai.testFail")}: ${err instanceof Error ? err.message : "Error"}`);
    } finally { setTesting(false); }
  };

  if (loading || !config) return <div className="p-8" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>;

  const update = (patch: Partial<AIConfig>) => setConfig({ ...config, ...patch });

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-1"><Sparkles size={22} style={{ color: "#af52de" }} /><h2 className="text-2xl font-bold">{t("ai.title")}</h2></div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{t("ai.desc")}</p>

      {configured ? (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 rounded-xl text-sm font-medium" style={{ background: "var(--success-light)", color: "var(--success)" }}>
          <CheckCircle2 size={15} /> {t("ai.configured")}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 rounded-xl text-sm font-medium" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
          <AlertCircle size={15} /> {t("ai.notConfigured")}
        </div>
      )}

      {msg && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: msg.type === "success" ? "var(--success-light)" : "var(--danger-light)", color: msg.type === "success" ? "var(--success)" : "var(--danger)" }}>{msg.text}</div>}

      <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
        <div className="pb-4" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>{t("ai.provider")}</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("ai.providerHint")}</p>
        </div>

        <Field label={t("ai.baseURL")} icon={<Link2 size={14} />} hint={t("ai.baseURLHint")}>
          <input type="text" value={config.baseURL} onChange={(e) => update({ baseURL: e.target.value })} placeholder={t("ai.baseURLPlaceholder")} className="w-full font-mono text-sm" />
        </Field>

        <Field label={t("ai.apiKey")} icon={<Key size={14} />}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={config.apiKeySet ? t("ai.apiKeySet") : t("ai.apiKeyPlaceholder")}
                className="w-full font-mono text-sm pr-10"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer" style={{ color: "var(--text-tertiary)" }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </Field>

        <Field label={t("ai.model")} icon={<Cpu size={14} />} hint={t("ai.modelHint")}>
          <input type="text" value={config.model} onChange={(e) => update({ model: e.target.value })} placeholder={t("ai.modelPlaceholder")} className="w-full font-mono text-sm" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("ai.temperature")} icon={<Sliders size={14} />} hint={t("ai.temperatureHint")}>
            <input type="number" step="0.1" min="0" max="2" value={config.temperature} onChange={(e) => update({ temperature: parseFloat(e.target.value) || 0 })} className="w-full font-mono text-sm" />
          </Field>
          <Field label={t("ai.maxTokens")} icon={<Sliders size={14} />}>
            <input type="number" step="256" min="256" max="32000" value={config.maxTokens} onChange={(e) => update({ maxTokens: parseInt(e.target.value) || 4096 })} className="w-full font-mono text-sm" />
          </Field>
        </div>

        <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid var(--border-light)" }}>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)" }}>
            <Save size={14} /> {saving ? t("ai.saving") : t("ai.save")}
          </button>
          <button onClick={handleTest} disabled={testing || !configured} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
            <Zap size={14} /> {testing ? t("ai.testing") : t("ai.test")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {icon && <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>{hint}</p>}
    </div>
  );
}
