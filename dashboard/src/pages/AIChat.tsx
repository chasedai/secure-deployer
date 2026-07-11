import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Send, Trash2, Loader2, Server, Sparkles, Wrench, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, User, Zap, AlertTriangle, Bot, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getChatHistory, clearChatHistory, setChatAutoApprove, getAgentConfig, getAIConfig as fetchAIConfig, type ChatMessage, type ChatToolCall } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useServer } from "../lib/serverContext";

interface ToolEventLog { type: string; [key: string]: unknown; }

function findEventBoundary(s: string): number {
  const a = s.indexOf("\n\n");
  const b = s.indexOf("\r\n\r\n");
  if (a < 0) return b;
  if (b < 0) return a;
  return Math.min(a, b);
}

export default function AIChatPage() {
  const { t } = useI18n();
  const { selectedId, selected } = useServer();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiConfigured, setAIConfigured] = useState<boolean | null>(null);
  const [executionMode, setExecutionMode] = useState<"approval" | "auto" | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [toolEvents, setToolEvents] = useState<Record<string, ToolEventLog[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchAIConfig().then((r) => setAIConfigured(r.configured)).catch(() => setAIConfigured(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setToolEvents({});
    Promise.all([
      getChatHistory(selectedId).catch(() => ({ messages: [], autoApprove: false })),
      getAgentConfig(selectedId).catch(() => null),
    ]).then(([chat, cfg]) => {
      setMessages(chat.messages);
      setAutoApprove(chat.autoApprove);
      if (cfg) setExecutionMode(cfg.executionMode);
    }).finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  useEffect(() => {
    const prefill = sessionStorage.getItem("sd_prefill_chat");
    if (prefill && !loading && aiConfigured) {
      sessionStorage.removeItem("sd_prefill_chat");
      setInput(prefill);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, aiConfigured]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending || !selectedId) return;

    if (executionMode === "approval" && !autoApprove && !showApproveDialog) {
      (window as unknown as { __pendingChat?: string }).__pendingChat = content;
      setShowApproveDialog(true);
      return;
    }

    setInput("");
    setSending(true);
    setThinking(true);

    const tempUser: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content, timestamp: Date.now() };
    setMessages((m) => [...m, tempUser]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`/local/servers/${selectedId}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.text().catch(() => "HTTP error");
        throw new Error(err);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE events are separated by a blank line: \n\n (or \r\n\r\n).
        let sepIdx: number;
        while ((sepIdx = findEventBoundary(buf)) >= 0) {
          const rawEvent = buf.slice(0, sepIdx);
          const sepLen = buf.startsWith("\r\n\r\n", sepIdx) ? 4 : 2;
          buf = buf.slice(sepIdx + sepLen);
          const dataLines: string[] = [];
          for (const line of rawEvent.split(/\r?\n/)) {
            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^ /, ""));
            }
          }
          if (dataLines.length === 0) continue;
          const payload = dataLines.join("\n");
          try {
            handleEvent(JSON.parse(payload));
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: `Error: ${(err as Error).message}`, timestamp: Date.now(), error: true }]);
      }
    } finally {
      setSending(false);
      setThinking(false);
      abortRef.current = null;
    }
  }, [input, sending, selectedId, executionMode, autoApprove, showApproveDialog]);

  const handleEvent = (evt: { type: string; [k: string]: unknown }) => {
    switch (evt.type) {
      case "user_message":
        setMessages((m) => {
          const msg = evt.message as ChatMessage;
          const filtered = m.filter((x) => !x.id.startsWith("tmp-"));
          if (filtered.some((x) => x.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
        break;
      case "assistant_start": {
        const id = evt.messageId as string;
        const timestamp = (evt.timestamp as number) || Date.now();
        setMessages((m) => {
          if (m.some((x) => x.id === id)) return m;
          return [...m, { id, role: "assistant", content: "", timestamp, streaming: true }];
        });
        setThinking(true);
        break;
      }
      case "assistant_reasoning_start": {
        const id = evt.messageId as string;
        setMessages((m) => m.map((mm) => mm.id === id ? { ...mm, reasoningStreaming: true, reasoningContent: mm.reasoningContent || "" } : mm));
        break;
      }
      case "assistant_delta": {
        const id = evt.messageId as string;
        const field = evt.field as "content" | "reasoning";
        const delta = (evt.delta as string) || "";
        setMessages((m) => m.map((mm) => {
          if (mm.id !== id) return mm;
          if (field === "reasoning") {
            return { ...mm, reasoningContent: (mm.reasoningContent || "") + delta, reasoningStreaming: true };
          }
          return { ...mm, content: (mm.content || "") + delta };
        }));
        if (field === "content") setThinking(false);
        break;
      }
      case "assistant_reasoning_end": {
        const id = evt.messageId as string;
        const durationMs = (evt.durationMs as number) || 0;
        setMessages((m) => m.map((mm) => mm.id === id ? { ...mm, reasoningStreaming: false, reasoningDurationMs: durationMs } : mm));
        break;
      }
      case "assistant_done": {
        const id = evt.messageId as string;
        const reasoningDurationMs = (evt.reasoningDurationMs as number) || 0;
        const toolCalls = (evt.toolCalls as ChatToolCall[]) || [];
        setMessages((m) => m.map((mm) => {
          if (mm.id !== id) return mm;
          return {
            ...mm,
            streaming: false,
            reasoningStreaming: false,
            reasoningDurationMs: mm.reasoningDurationMs || reasoningDurationMs,
            toolCalls: toolCalls.length > 0 ? toolCalls : mm.toolCalls,
          };
        }));
        setThinking(false);
        break;
      }
      case "tool_call_start":
        setThinking(false);
        break;
      case "tool_event": {
        const callId = evt.callId as string;
        const event = evt.event as ToolEventLog;
        setToolEvents((te) => ({ ...te, [callId]: [...(te[callId] || []), event] }));
        break;
      }
      case "tool_call_result": {
        const msgId = evt.messageId as string;
        const callId = evt.callId as string;
        const result = evt.result as Record<string, unknown>;
        setMessages((m) => m.map((mm) => {
          if (mm.id !== msgId || !mm.toolCalls) return mm;
          return { ...mm, toolCalls: mm.toolCalls.map((tc) => tc.id === callId ? { ...tc, result } : tc) };
        }));
        break;
      }
      case "error":
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: (evt.error as string) || "Unknown error", timestamp: Date.now(), error: true }]);
        setThinking(false);
        break;
    }
  };

  const handleClear = async () => {
    if (!selectedId || !confirm(t("chat.clearConfirm"))) return;
    await clearChatHistory(selectedId);
    setMessages([]);
    setToolEvents({});
  };

  const handleApprove = async (enable: boolean) => {
    if (!selectedId) return;
    setShowApproveDialog(false);
    await setChatAutoApprove(selectedId, enable);
    setAutoApprove(enable);
    const pending = (window as unknown as { __pendingChat?: string }).__pendingChat;
    if (pending) {
      (window as unknown as { __pendingChat?: string }).__pendingChat = undefined;
      setTimeout(() => handleSend(pending), 50);
    }
  };

  const toggleAutoApprove = async () => {
    if (!selectedId) return;
    const next = !autoApprove;
    await setChatAutoApprove(selectedId, next);
    setAutoApprove(next);
  };

  if (!selectedId) return (
    <div className="flex items-center justify-center h-full"><div className="text-center"><Server size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} /><p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>{t("servers.selectHint")}</p></div></div>
  );

  if (aiConfigured === false) return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <Sparkles size={48} className="mx-auto mb-4" style={{ color: "#af52de", opacity: 0.4 }} />
        <h3 className="text-xl font-semibold mb-2">{t("chat.aiNotConfigured")}</h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{t("chat.aiNotConfiguredHint")}</p>
        <button onClick={() => navigate("/ai-config")} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>{t("chat.goToAIConfig")}</button>
      </div>
    </div>
  );

  const suggestions = [
    { key: "systemInfo", icon: Server },
    { key: "diskUsage", icon: Wrench },
    { key: "authLog", icon: AlertCircle },
    { key: "processes", icon: Zap },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8 pb-4 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-light)" }}>
        <Sparkles size={22} style={{ color: "#af52de" }} />
        <div className="flex-1">
          <h2 className="text-xl font-bold">{t("chat.title")}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{selected?.name} · {selected?.host}:{selected?.port}</p>
        </div>
        <button onClick={toggleAutoApprove} disabled={executionMode === "auto"} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:cursor-default transition-all" style={{ background: autoApprove || executionMode === "auto" ? "var(--success-light)" : "var(--bg-primary)", color: autoApprove || executionMode === "auto" ? "var(--success)" : "var(--text-secondary)", border: "1px solid var(--border-light)" }} title={executionMode === "auto" ? t("settings.modeAuto") : ""}>
          <Zap size={12} /> {executionMode === "auto" ? t("chat.autoApproveOn") : autoApprove ? t("chat.autoApproveOn") : t("chat.autoApproveOff")}
        </button>
        <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all hover:bg-black/5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
          <Trash2 size={12} /> {t("chat.clear")}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
        ) : messages.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <Bot size={52} className="mx-auto mb-4" style={{ color: "#af52de", opacity: 0.4 }} />
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{t("chat.empty")}</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>{t("chat.suggestedPrompts")}</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map(({ key, icon: Icon }) => (
                <button key={key} onClick={() => handleSend(t(`chat.suggest.${key}`))} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left cursor-pointer transition-all hover:bg-black/5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}>
                  <Icon size={14} style={{ color: "var(--text-tertiary)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{t(`chat.suggest.${key}`)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m) => <MessageItem key={m.id} msg={m} toolEvents={toolEvents} />)}
            {thinking && !messages.some((m) => m.streaming) && (
              <div className="flex items-center gap-3" style={{ color: "var(--text-tertiary)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f3e5ff" }}>
                  <Sparkles size={15} style={{ color: "#af52de" }} />
                </div>
                <div className="flex items-center gap-2 text-sm"><Loader2 size={14} className="animate-spin" /> {t("chat.sending")}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-8 py-4" style={{ borderTop: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t("chat.placeholder")}
            disabled={sending}
            rows={1}
            className="flex-1 resize-none text-sm rounded-xl px-4 py-2.5"
            style={{ maxHeight: 160 }}
          />
          <button onClick={() => handleSend()} disabled={sending || !input.trim()} className="p-2.5 rounded-xl text-white cursor-pointer disabled:opacity-40 transition-all" style={{ background: "var(--accent)" }}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {showApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="rounded-2xl p-6 max-w-md" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)" }}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={22} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold mb-1.5">{t("chat.approveTitle")}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t("chat.approveDesc")}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleApprove(false)} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>{t("chat.approveNo")}</button>
              <button onClick={() => handleApprove(true)} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>{t("chat.approveYes")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageItem({ msg, toolEvents }: { msg: ChatMessage; toolEvents: Record<string, ToolEventLog[]> }) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="rounded-2xl px-4 py-2.5 max-w-[80%]" style={{ background: "var(--accent)", color: "#fff" }}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-light)" }}>
          <User size={15} style={{ color: "var(--accent)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: msg.error ? "var(--danger-light)" : "#f3e5ff" }}>
        <Sparkles size={15} style={{ color: msg.error ? "var(--danger)" : "#af52de" }} />
      </div>
      <div className="flex-1 min-w-0 space-y-2.5">
        {(msg.reasoningContent || msg.reasoningStreaming) && (
          <ReasoningCard content={msg.reasoningContent || ""} streaming={Boolean(msg.reasoningStreaming)} durationMs={msg.reasoningDurationMs} />
        )}
        {msg.streaming && !msg.content && !msg.reasoningContent && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
            <Loader2 size={14} className="animate-spin" />
            <span>…</span>
          </div>
        )}
        {msg.content && (
          <div className="markdown-content text-sm leading-relaxed" style={{ color: msg.error ? "var(--danger)" : "var(--text-primary)" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
        {msg.toolCalls?.map((tc) => <ToolCallCard key={tc.id} call={tc} events={toolEvents[tc.id] || []} />)}
      </div>
    </div>
  );
}

function ReasoningCard({ content, streaming, durationMs }: { content: string; streaming: boolean; durationMs?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(streaming);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const preRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streaming) {
      setOpen(true);
      setAutoCollapsed(false);
    } else if (!autoCollapsed) {
      setOpen(false);
      setAutoCollapsed(true);
    }
  }, [streaming, autoCollapsed]);

  useEffect(() => {
    if (open && streaming && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [content, open, streaming]);

  const seconds = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : null;
  const label = streaming
    ? t("chat.thinking")
    : seconds
      ? t("chat.thoughtFor").replace("{seconds}", String(seconds))
      : t("chat.thoughtDone");

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(175, 82, 222, 0.05)", border: "1px solid rgba(175, 82, 222, 0.18)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-left">
        {streaming ? <Loader2 size={13} className="animate-spin" style={{ color: "#af52de" }} /> : <Brain size={13} style={{ color: "#af52de" }} />}
        <span className="text-xs font-medium flex-1" style={{ color: "#7f3cbf" }}>{label}</span>
        {!streaming && <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{open ? t("chat.collapse") : t("chat.expand")}</span>}
        {open ? <ChevronDown size={14} style={{ color: "#af52de" }} /> : <ChevronRight size={14} style={{ color: "#af52de" }} />}
      </button>
      {open && (
        <div ref={preRef} className="px-3 pb-3 text-xs whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto" style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {content || "…"}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ call, events }: { call: ChatToolCall; events: ToolEventLog[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const result = call.result as null | Record<string, unknown>;
  const isPending = result === null;
  const status = (result?.status as string) || "";
  const error = (result?.error as string) || "";

  const badge = !result ? { label: events.some((e) => e.type === "task_approved") ? t("chat.pendingApproval") : "…", color: "var(--warning)", bg: "var(--warning-light)" }
    : status === "completed" ? { label: t("chat.completed"), color: "var(--success)", bg: "var(--success-light)" }
    : status === "pending_approval" ? { label: t("chat.pendingApproval"), color: "var(--warning)", bg: "var(--warning-light)" }
    : status === "blocked" ? { label: t("chat.blocked"), color: "var(--danger)", bg: "var(--danger-light)" }
    : status === "rejected" ? { label: t("chat.rejected"), color: "var(--danger)", bg: "var(--danger-light)" }
    : error ? { label: t("chat.failed"), color: "var(--danger)", bg: "var(--danger-light)" }
    : { label: t("chat.completed"), color: "var(--success)", bg: "var(--success-light)" };

  const icon = isPending ? <Loader2 size={13} className="animate-spin" /> : (status === "completed" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />);

  const label = call.name === "execute_command" ? (call.args.cmd as string) : call.name === "read_file" || call.name === "write_file" || call.name === "delete_file" || call.name === "list_directory" ? (call.args.path as string) : call.name;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-left">
        {open ? <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />}
        <Wrench size={13} style={{ color: "var(--text-tertiary)" }} />
        <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{call.name} · {label}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: badge.color, background: badge.bg }}>
          {icon} {badge.label}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-xs">
          {call.args.description !== undefined && (
            <div><span className="font-semibold" style={{ color: "var(--text-tertiary)" }}>描述: </span><span>{String(call.args.description)}</span></div>
          )}
          {call.name === "execute_command" && call.args.cmd !== undefined && (
            <pre className="p-2 rounded-lg font-mono text-[11px] whitespace-pre-wrap break-all" style={{ background: "#1a1a1a", color: "#e0e0e0" }}>{String(call.args.cmd)}</pre>
          )}
          {result && typeof result === "object" && (
            <div className="space-y-1.5">
              {typeof result.exitCode !== "undefined" && <div><span style={{ color: "var(--text-tertiary)" }}>{t("chat.exitCode")}: </span><code>{String(result.exitCode)}</code></div>}
              {typeof result.durationMs !== "undefined" && <div><span style={{ color: "var(--text-tertiary)" }}>{t("chat.duration")}: </span><code>{String(result.durationMs)}ms</code></div>}
              {typeof result.stdout === "string" && (result.stdout as string).length > 0 && (
                <div><p style={{ color: "var(--text-tertiary)" }} className="mb-1">stdout:</p><pre className="p-2 rounded-lg font-mono text-[11px] whitespace-pre-wrap max-h-60 overflow-y-auto" style={{ background: "#1a1a1a", color: "#e0e0e0" }}>{result.stdout as string}</pre></div>
              )}
              {typeof result.stderr === "string" && (result.stderr as string).length > 0 && (
                <div><p style={{ color: "var(--warning)" }} className="mb-1">stderr:</p><pre className="p-2 rounded-lg font-mono text-[11px] whitespace-pre-wrap max-h-60 overflow-y-auto" style={{ background: "#1a1a1a", color: "#ff9500" }}>{result.stderr as string}</pre></div>
              )}
              {typeof result.content === "string" && (
                <pre className="p-2 rounded-lg font-mono text-[11px] whitespace-pre-wrap max-h-80 overflow-y-auto" style={{ background: "#1a1a1a", color: "#e0e0e0" }}>{result.content as string}</pre>
              )}
              {typeof result.error === "string" && (
                <p style={{ color: "var(--danger)" }}>{result.error as string}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageSquareIcon() { return <MessageSquare size={17} />; }
