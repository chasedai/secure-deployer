import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Approval from "./pages/Approval";
import TerminalPage from "./pages/Terminal";
import FileManager from "./pages/FileManager";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";
import SkillGen from "./pages/SkillGen";
import ServerManage from "./pages/ServerManage";
import { authCheck, getPendingTasks, getUnreadAlertCount, connectSSE, type Task } from "./lib/api";
import { ServerProvider, useServer } from "./lib/serverContext";
import { useI18n } from "./lib/i18n";

type AuthState = "loading" | "needs_setup" | "needs_login" | "authenticated";

function AuthenticatedApp() {
  const { t } = useI18n();
  const { selectedId } = useServer();
  const [pendingCount, setPendingCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!selectedId) return;
    getPendingTasks(selectedId).then(({ tasks }) => setPendingCount(tasks.length)).catch(() => setPendingCount(0));
    getUnreadAlertCount(selectedId).then(({ unread }) => setAlertCount(unread)).catch(() => setAlertCount(0));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const es = connectSSE(selectedId, (event, data) => {
      if (event === "new_task") setPendingCount((c) => c + 1);
      if (event === "task_updated") {
        const task = data as Task;
        if (task.status !== "pending_approval") setPendingCount((c) => Math.max(0, c - 1));
      }
      if (event === "command_blocked") setAlertCount((c) => c + 1);
    });
    return () => es.close();
  }, [selectedId]);

  return (
    <Routes>
      <Route element={<Layout pendingCount={pendingCount} alertCount={alertCount} />}>
        <Route path="/" element={<Overview />} />
        <Route path="/approval" element={<Approval onCountChange={setPendingCount} onAlertCountChange={setAlertCount} />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/skill" element={<SkillGen />} />
        <Route path="/servers" element={<ServerManage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>("loading");

  const checkAuth = useCallback(async () => {
    try {
      const { passwordSet } = await authCheck();
      if (!passwordSet) { setAuthState("needs_setup"); return; }
      try {
        await authCheck();
        setAuthState("authenticated");
      } catch { setAuthState("needs_login"); }
    } catch { setAuthState("needs_login"); }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (authState === "loading") {
    return <div className="flex items-center justify-center h-screen"><div className="text-lg" style={{ color: "var(--text-secondary)" }}>{t("common.loading")}</div></div>;
  }

  if (authState === "needs_setup" || authState === "needs_login") {
    return <Login mode={authState === "needs_setup" ? "setup" : "login"} onSuccess={() => setAuthState("authenticated")} />;
  }

  return (
    <ServerProvider>
      <AuthenticatedApp />
    </ServerProvider>
  );
}
