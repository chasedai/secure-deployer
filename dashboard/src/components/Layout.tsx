import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, Terminal, FolderOpen, History, Settings, FileText, Globe, AlertTriangle, Server, ChevronDown } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";
import { useState, useRef, useEffect } from "react";

const navKeys = [
  { to: "/", icon: LayoutDashboard, key: "nav.overview" },
  { to: "/approval", icon: ShieldCheck, key: "nav.approval" },
  { to: "/terminal", icon: Terminal, key: "nav.terminal" },
  { to: "/files", icon: FolderOpen, key: "nav.files" },
  { to: "/history", icon: History, key: "nav.history" },
  { to: "/settings", icon: Settings, key: "nav.settings" },
  { to: "/skill", icon: FileText, key: "nav.skill" },
  { to: "/servers", icon: Server, key: "nav.servers" },
];

export default function Layout({ pendingCount, alertCount }: { pendingCount: number; alertCount: number }) {
  const { t, lang, setLang } = useI18n();
  const { servers, selected, setSelectedId } = useServer();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-primary)" }}>
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-light)" }}>
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Secure Deployer</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{t("nav.subtitle")}</p>
        </div>

        {servers.length > 0 && (
          <div className="px-3 mb-2 relative" ref={dropRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all hover:bg-black/[0.04]"
              style={{ border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selected ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="flex-1 text-left truncate">{selected?.name || t("servers.selectHint")}</span>
              <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
            </button>
            {dropdownOpen && (
              <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-light)" }}>
                {servers.map((s) => (
                  <button key={s.id} onClick={() => { setSelectedId(s.id); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left cursor-pointer transition-colors hover:bg-black/[0.04]"
                    style={{ color: s.id === selected?.id ? "var(--accent)" : "var(--text-primary)", fontWeight: s.id === selected?.id ? 600 : 400 }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navKeys.map(({ to, icon: Icon, key }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${isActive ? "text-white shadow-sm" : "hover:bg-black/[0.04]"}`}
              style={({ isActive }) => isActive ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text-secondary)" }}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span className="flex-1">{t(key)}</span>
              {to === "/approval" && (
                <span className="flex items-center gap-1.5">
                  {alertCount > 0 && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                  {pendingCount > 0 && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: "var(--accent)", color: "#fff" }}>{pendingCount}</span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-2">
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all hover:bg-black/[0.04]" style={{ color: "var(--text-secondary)" }}>
            <Globe size={16} strokeWidth={1.8} />{lang === "zh" ? "English" : "中文"}
          </button>
        </div>
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border-light)" }}>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>v2.0.0</span>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><Outlet /></main>
    </div>
  );
}
