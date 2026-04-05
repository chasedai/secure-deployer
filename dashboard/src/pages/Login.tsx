import { useState } from "react";
import { Shield } from "lucide-react";
import { authSetup, authLogin } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface Props { mode: "setup" | "login"; onSuccess: () => void; }

export default function Login({ mode, onSuccess }: Props) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (mode === "setup" && password !== confirm) { setError(t("login.mismatch")); return; }
    if (password.length < 4) { setError(t("login.tooShort")); return; }
    setLoading(true);
    try {
      if (mode === "setup") await authSetup(password); else await authLogin(password);
      onSuccess();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-light)" }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: "var(--accent-light)" }}>
            <Shield size={28} style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="text-xl font-bold">{t("login.title")}</h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{mode === "setup" ? t("login.setup") : t("login.prompt")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" placeholder={t("login.password")} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" autoFocus />
          {mode === "setup" && <input type="password" placeholder={t("login.confirm")} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full" />}
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {loading ? t("login.processing") : mode === "setup" ? t("login.setupBtn") : t("login.loginBtn")}
          </button>
        </form>
      </div>
    </div>
  );
}
