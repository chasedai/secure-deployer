import { useState } from "react";
import { FileText, Copy, Download, Check, RefreshCw } from "lucide-react";
import { generateSkill } from "../lib/api";
import { copyToClipboard } from "../lib/utils";
import { useI18n } from "../lib/i18n";

export default function SkillGen() {
  const { t, lang } = useI18n();
  const [extraNotes, setExtraNotes] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => { setLoading(true); try { const { markdown: md } = await generateSkill(lang, extraNotes.trim()); setMarkdown(md); } catch {} finally { setLoading(false); } };
  const handleCopy = async () => { const ok = await copyToClipboard(markdown); if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const handleDownload = () => { const blob = new Blob([markdown], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "SKILL.md"; a.click(); URL.revokeObjectURL(url); };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1"><FileText size={22} style={{ color: "#34c759" }} /><h2 className="text-2xl font-bold">{t("skill.title")}</h2></div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{t("skill.desc")}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <Card title={t("skill.config")}>
            <div className="space-y-4">
              <Field label={t("skill.extraNotes")}><textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={3} placeholder={t("skill.extraNotesPlaceholder")} className="w-full" /></Field>
              <button onClick={handleGenerate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-40" style={{ background: "var(--accent)" }}>{loading ? <RefreshCw size={15} className="animate-spin" /> : <FileText size={15} />}{loading ? t("skill.generating") : t("skill.generate")}</button>
            </div>
          </Card>
          <Card title={t("skill.usage")}>
            <div className="space-y-4">
              <div><p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{t("skill.usagePrep")}</p><ol className="text-sm space-y-1.5 list-decimal list-inside" style={{ color: "var(--text-secondary)" }}><li>{t("skill.usageStep1")}</li><li>{t("skill.usageStep3")}</li></ol></div>
              <div className="pt-3" style={{ borderTop: "1px solid var(--border-light)" }}><p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{t("skill.usageOC")}</p><ol className="text-sm space-y-1.5 list-decimal list-inside" style={{ color: "var(--text-secondary)" }}><li>{t("skill.usageOCStep1")}<code className="text-xs px-1.5 py-0.5 rounded block mt-1 mb-1" style={{ background: "var(--bg-primary)" }}>mkdir -p ~/.openclaw/workspace/skills/secure-deployer</code></li><li>{t("skill.usageOCStep2", "SKILL.md")}</li><li>{t("skill.usageOCStep3", "/new")}</li></ol></div>
              <div className="pt-3" style={{ borderTop: "1px solid var(--border-light)" }}><p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{t("skill.usageGeneric")}</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("skill.usageGenericDesc")}</p></div>
            </div>
          </Card>
        </div>
        <div>
          <Card title={t("skill.preview")} action={markdown ? (<div className="flex gap-2"><button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ color: "var(--text-secondary)", background: "var(--bg-primary)" }}>{copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />} {copied ? t("common.copied") : t("common.copy")}</button><button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ color: "var(--text-secondary)", background: "var(--bg-primary)" }}><Download size={13} /> {t("skill.downloadMd")}</button></div>) : undefined}>
            <div className="min-h-[480px] max-h-[calc(100vh-280px)] overflow-auto rounded-xl p-4 font-mono text-xs leading-5 whitespace-pre-wrap" style={{ background: "var(--bg-primary)" }}>{markdown || <span style={{ color: "var(--text-tertiary)" }}>{t("skill.previewHint")}</span>}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return (<div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}><div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">{title}</h3>{action}</div>{children}</div>); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>; }
