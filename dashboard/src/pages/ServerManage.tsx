import { useState, useEffect, useCallback } from "react";
import { Server, Plus, Trash2, Edit3, Check, Wifi, WifiOff, X } from "lucide-react";
import { getServers, addServer, updateServerAPI, removeServer, checkServerHealth, type Server as ServerType } from "../lib/api";
import { useServer } from "../lib/serverContext";
import { useI18n } from "../lib/i18n";

export default function ServerManage() {
  const { t } = useI18n();
  const { refresh } = useServer();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", host: "", port: "9876", apiKey: "", managementSecret: "" });

  const load = useCallback(async () => {
    try {
      const { servers: list } = await getServers();
      setServers(list);
      for (const s of list) {
        checkServerHealth(s.id).then((r) => setHealth((h) => ({ ...h, [s.id]: r.ok }))).catch(() => setHealth((h) => ({ ...h, [s.id]: false })));
      }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.host || !form.managementSecret) return;
    await addServer({ name: form.name || `server-${servers.length + 1}`, host: form.host, port: parseInt(form.port) || 9876, apiKey: form.apiKey, managementSecret: form.managementSecret });
    setForm({ name: "", host: "", port: "9876", apiKey: "", managementSecret: "" });
    setAdding(false);
    await load();
    await refresh();
  };

  const handleUpdate = async (id: string) => {
    await updateServerAPI(id, { name: form.name, host: form.host, port: parseInt(form.port), apiKey: form.apiKey, managementSecret: form.managementSecret });
    setEditing(null);
    await load();
    await refresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t("servers.removeConfirm"))) return;
    await removeServer(id);
    await load();
    await refresh();
  };

  const startEdit = (s: ServerType) => {
    setEditing(s.id);
    setForm({ name: s.name, host: s.host, port: String(s.port), apiKey: s.apiKey, managementSecret: s.managementSecret });
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Server size={24} style={{ color: "var(--accent)" }} />
        <h2 className="text-2xl font-bold">{t("servers.title")}</h2>
        <button onClick={() => { setAdding(true); setForm({ name: "", host: "", port: "9876", apiKey: "", managementSecret: "" }); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
          style={{ background: "var(--accent)" }}>
          <Plus size={16} /> {t("servers.add")}
        </button>
      </div>

      {adding && (
        <div className="mb-5 rounded-2xl p-5" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--accent)" }}>
          <h3 className="text-sm font-semibold mb-4">{t("servers.add")}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-server" className="w-full" /></div>
            <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.host")} *</label><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="203.0.113.10" className="w-full" /></div>
            <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.port")}</label><input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="9876" className="w-full" /></div>
            <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.apiKey")}</label><input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." className="w-full font-mono text-xs" /></div>
            <div className="col-span-2"><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.manageSecret")} *</label><input value={form.managementSecret} onChange={(e) => setForm({ ...form, managementSecret: e.target.value })} placeholder="ms-..." className="w-full font-mono text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.host || !form.managementSecret} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-40" style={{ background: "var(--success)" }}><Check size={15} className="inline mr-1" />{t("common.confirm")}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {servers.length === 0 && !adding ? (
        <div className="text-center py-20">
          <Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.noServers")}</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t("servers.noServersHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", border: editing === s.id ? "1px solid var(--accent)" : "1px solid var(--border-light)" }}>
              {editing === s.id ? (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" /></div>
                    <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.host")}</label><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="w-full" /></div>
                    <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.port")}</label><input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className="w-full" /></div>
                    <div><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.apiKey")}</label><input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full font-mono text-xs" /></div>
                    <div className="col-span-2"><label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("servers.manageSecret")}</label><input value={form.managementSecret} onChange={(e) => setForm({ ...form, managementSecret: e.target.value })} className="w-full font-mono text-xs" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(s.id)} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--success)" }}>{t("common.save")}</button>
                    <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>{t("common.cancel")}</button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4 flex items-center gap-4">
                  {health[s.id] ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{s.host}:{s.port}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${health[s.id] ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-100"}`}>{health[s.id] ? t("servers.online") : t("servers.offline")}</span>
                    </div>
                    {s.projects && s.projects.length > 0 && (
                      <div className="flex gap-2 mt-1">{s.projects.map((p, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-md" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{p.name}</span>)}</div>
                    )}
                  </div>
                  <button onClick={() => startEdit(s)} className="p-2 rounded-lg cursor-pointer hover:bg-black/[0.04]" style={{ color: "var(--text-secondary)" }}><Edit3 size={16} /></button>
                  <button onClick={() => handleRemove(s.id)} className="p-2 rounded-lg cursor-pointer hover:bg-black/[0.04]" style={{ color: "var(--danger)" }}><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
