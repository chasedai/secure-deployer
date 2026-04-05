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
import { authCheck, connectSSE, getPendingTasks, getUnreadAlertCount, type Task } from "./lib/api";
import { useI18n } from "./lib/i18n";

type AuthState = "loading" | "needs_setup" | "needs_login" | "authenticated";

export default function App() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [pendingCount, setPendingCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  const checkAuth = useCallback(async () => {
    try {
      const { passwordSet } = await authCheck();
      if (!passwordSet) {
        setAuthState("needs_setup");
      } else {
        try {
          const { tasks } = await getPendingTasks();
          setPendingCount(tasks.length);
          const { unread } = await getUnreadAlertCount();
          setAlertCount(unread);
          setAuthState("authenticated");
        } catch {
          setAuthState("needs_login");
        }
      }
    } catch {
      setAuthState("needs_login");
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const es = connectSSE((event, data) => {
      if (event === "new_task") setPendingCount((c) => c + 1);
      if (event === "task_updated") {
        const task = data as Task;
        if (task.status !== "pending_approval") setPendingCount((c) => Math.max(0, c - 1));
      }
      if (event === "command_blocked") setAlertCount((c) => c + 1);
    });
    return () => es.close();
  }, [authState]);

  if (authState === "loading") {
    return <div className="flex items-center justify-center h-screen"><div className="text-lg" style={{ color: "var(--text-secondary)" }}>{t("common.loading")}</div></div>;
  }

  if (authState === "needs_setup" || authState === "needs_login") {
    return (
      <Login mode={authState === "needs_setup" ? "setup" : "login"} onSuccess={() => {
        setAuthState("authenticated");
        getPendingTasks().then(({ tasks }) => setPendingCount(tasks.length)).catch(() => {});
        getUnreadAlertCount().then(({ unread }) => setAlertCount(unread)).catch(() => {});
      }} />
    );
  }

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
