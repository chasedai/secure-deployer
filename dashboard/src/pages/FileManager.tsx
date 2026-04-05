import { useState, useEffect } from "react";
import { FolderOpen, File, ChevronRight, ArrowUp, RefreshCw, Download, Save, X } from "lucide-react";
import { getConfig } from "../lib/api";
import { formatBytes } from "../lib/utils";
import { useI18n } from "../lib/i18n";

interface FileEntry { name: string; path: string; isDirectory: boolean; size: number; modified: string | null; }

export default function FileManager() {
  const { t } = useI18n();
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState(""); const [apiPort, setApiPort] = useState(9876);

  useEffect(() => { getConfig().then((c) => { setCurrentPath(c.defaultCwd); setApiKey(c.apiKey); setApiPort(c.apiPort); }).catch(() => {}); }, []);
  useEffect(() => { if (currentPath && apiKey) loadDir(currentPath); }, [currentPath, apiKey]);

  const apiCall = (path: string, options?: RequestInit) => fetch(`http://localhost:${apiPort}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, ...options });
  const loadDir = async (dir: string) => { setLoading(true); try { const res = await apiCall(`/api/files/list?path=${encodeURIComponent(dir)}`); const data = await res.json(); if (data.entries) setEntries(data.entries); } catch {} finally { setLoading(false); } };
  const openFile = async (entry: FileEntry) => { if (entry.isDirectory) { setCurrentPath(entry.path); setEditing(null); } else { try { const res = await apiCall(`/api/files/read?path=${encodeURIComponent(entry.path)}`); const data = await res.json(); if (data.content !== undefined) setEditing({ path: entry.path, content: data.content }); } catch {} } };
  const goUp = () => { setCurrentPath(currentPath.replace(/\/[^/]+\/?$/, "") || "/"); setEditing(null); };
  const saveFile = async () => { if (!editing) return; setSaving(true); try { await apiCall("/api/files/write", { method: "POST", body: JSON.stringify({ path: editing.path, content: editing.content, description: "Manual edit from Dashboard" }) }); setEditing(null); loadDir(currentPath); } catch {} finally { setSaving(false); } };
  const downloadFile = (path: string) => { const a = document.createElement("a"); a.href = `http://localhost:${apiPort}/api/files/download?path=${encodeURIComponent(path)}`; a.download = path.split("/").pop() || "file"; a.click(); };

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4"><FolderOpen size={22} style={{ color: "var(--accent)" }} /><h2 className="text-2xl font-bold">{t("files.title")}</h2></div>
      <div className="flex items-center gap-1 mb-4 text-sm flex-wrap" style={{ color: "var(--text-secondary)" }}>
        <button onClick={() => setCurrentPath("/")} className="hover:text-black cursor-pointer font-medium">/</button>
        {pathParts.map((part, i) => <span key={i} className="flex items-center gap-1"><ChevronRight size={14} /><button onClick={() => setCurrentPath("/" + pathParts.slice(0, i + 1).join("/"))} className="hover:text-black cursor-pointer">{part}</button></span>)}
        <div className="ml-auto flex gap-1">
          <button onClick={goUp} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-secondary)" }} title={t("common.parentDir")}><ArrowUp size={16} /></button>
          <button onClick={() => loadDir(currentPath)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-secondary)" }} title={t("common.refresh")}><RefreshCw size={16} /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-4">
        <div className={`${editing ? "w-[380px] flex-shrink-0" : "flex-1"} overflow-y-auto rounded-2xl`} style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
          {loading ? <div className="p-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</div>
          : entries.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.emptyDir")}</div>
          : entries.map((entry) => (
            <div key={entry.path} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors hover:bg-black/[0.02]" style={{ borderBottom: "1px solid var(--border-light)" }} onClick={() => openFile(entry)}>
              {entry.isDirectory ? <FolderOpen size={16} style={{ color: "var(--accent)" }} /> : <File size={16} style={{ color: "var(--text-tertiary)" }} />}
              <span className="flex-1 truncate">{entry.name}</span>
              {!entry.isDirectory && <><span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{formatBytes(entry.size)}</span><button onClick={(e) => { e.stopPropagation(); downloadFile(entry.path); }} className="p-1 rounded-lg cursor-pointer" title={t("common.download")}><Download size={14} style={{ color: "var(--text-tertiary)" }} /></button></>}
            </div>
          ))}
        </div>
        {editing && (
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)" }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-light)" }}>
              <File size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-sm font-mono truncate flex-1">{editing.path.split("/").pop()}</span>
              <button onClick={saveFile} disabled={saving} className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ color: "var(--success)" }}><Save size={14} /> {saving ? t("files.saving") : t("files.save")}</button>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg cursor-pointer"><X size={16} style={{ color: "var(--text-tertiary)" }} /></button>
            </div>
            <textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="flex-1 p-4 font-mono text-sm bg-transparent border-0 resize-none outline-none leading-6" spellCheck={false} />
          </div>
        )}
      </div>
    </div>
  );
}
