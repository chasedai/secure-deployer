import { useState, useRef, useEffect } from "react";
import { Terminal as TermIcon, Play, Loader2, Server } from "lucide-react";
import { getAgentConfig } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";

interface OutputLine { type: "cmd" | "stdout" | "stderr" | "info" | "error"; text: string; }

export default function TerminalPage() {
  const { t } = useI18n();
  const { selectedId } = useServer();
  const [cmd, setCmd] = useState("");
  const [cwd, setCwd] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([{ type: "info", text: t("terminal.ready") }]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    getAgentConfig(selectedId).then((c) => { if (!cwd) setCwd(c.defaultCwd); }).catch(() => {});
  }, [selectedId]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [output]);

  if (!selectedId) return <div className="flex items-center justify-center h-full"><div className="text-center"><Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} /><p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.selectHint")}</p></div></div>;

  const runCommand = async () => {
    const trimmed = cmd.trim(); if (!trimmed || running) return;
    setHistory((h) => [trimmed, ...h].slice(0, 50)); setHistIdx(-1);
    setOutput((o) => [...o, { type: "cmd", text: `$ ${trimmed}` }]); setCmd(""); setRunning(true);
    try {
      const res = await fetch(`/local/servers/${selectedId}/terminal/exec`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ cmd: trimmed, cwd: cwd || undefined }) });
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body!.getReader(); const decoder = new TextDecoder(); let buf = "";
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buf += decoder.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop() || "";
          for (const line of lines) { if (!line.startsWith("data: ")) continue; try { const data = JSON.parse(line.slice(6)); if (data.done) setOutput((o) => [...o, { type: "info", text: `[exit ${data.exitCode}] (${data.duration}ms)` }]); else if (data.stream && data.data) setOutput((o) => [...o, { type: data.stream === "stderr" ? "stderr" : "stdout", text: data.data }]); } catch {} }
        }
      } else { const data = await res.json(); if (data.error) setOutput((o) => [...o, { type: "error", text: data.error }]); }
    } catch (err: unknown) { setOutput((o) => [...o, { type: "error", text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }]); }
    finally { setRunning(false); inputRef.current?.focus(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") runCommand();
    else if (e.key === "ArrowUp") { e.preventDefault(); if (history.length) { const n = Math.min(histIdx + 1, history.length - 1); setHistIdx(n); setCmd(history[n]); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setCmd(history[histIdx - 1]); } else { setHistIdx(-1); setCmd(""); } }
  };

  const lineColor = (type: string): React.CSSProperties => ({ cmd: { color: "#34c759" }, stdout: { color: "#e0e0e0" }, stderr: { color: "#ff9500" }, info: { color: "#0071e3" }, error: { color: "#ff3b30" } }[type] || {});

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4"><TermIcon size={22} style={{ color: "#34c759" }} /><h2 className="text-2xl font-bold">{t("terminal.title")}</h2></div>
      <div className="mb-3 flex gap-2 items-center"><span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("terminal.cwd")}</span><input value={cwd} onChange={(e) => setCwd(e.target.value)} className="flex-1 text-sm font-mono" placeholder="/home/ubuntu" /></div>
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
        <div ref={outputRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-6" style={{ background: "#1a1a1a" }} onClick={() => inputRef.current?.focus()}>{output.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all" style={lineColor(line.type)}>{line.text}</div>)}{running && <div className="flex items-center gap-2 mt-1" style={{ color: "#0071e3" }}><Loader2 size={14} className="animate-spin" /> {t("terminal.running")}</div>}</div>
        <div className="flex items-center" style={{ background: "#1a1a1a", borderTop: "1px solid #333" }}><span className="pl-4 font-mono text-sm" style={{ color: "#34c759" }}>$</span><input ref={inputRef} value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("terminal.placeholder")} disabled={running} className="terminal-input flex-1 font-mono text-sm" autoFocus /><button onClick={runCommand} disabled={running || !cmd.trim()} className="px-4 py-3 disabled:opacity-30 cursor-pointer" style={{ color: "#34c759" }}><Play size={16} /></button></div>
      </div>
    </div>
  );
}
