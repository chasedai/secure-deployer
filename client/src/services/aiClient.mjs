import { getAIConfig, getServer } from "./configStore.mjs";
import { TOOL_DEFINITIONS, executeTool } from "./aiTools.mjs";
import { getChat, getChatContext, appendMessage, updateMessage, setAutoApprove as persistAutoApprove } from "./chatStore.mjs";
import { randomBytes } from "node:crypto";

const MAX_TOOL_ROUNDS = 30;

function buildSystemPrompt(server) {
  const projects = (server.projects || []).map((p) => `- ${p.name || p}: ${p.description || ""}`.trim()).join("\n");
  return [
    `You are an intelligent operations assistant embedded inside the Secure Deployer dashboard.`,
    `You are connected to ONE specific remote server. Do not assume anything about other servers.`,
    ``,
    `Target server:`,
    `  Name: ${server.name}`,
    `  Host: ${server.host}:${server.port}`,
    projects ? `  Projects:\n${projects}` : "",
    ``,
    `Your capabilities (provided as tools):`,
    `- execute_command: run shell commands (non-interactive only).`,
    `- read_file / write_file / delete_file: file operations.`,
    `- list_directory: list directory contents.`,
    `- get_system_info: basic system overview.`,
    ``,
    `Rules:`,
    `1. Always use non-interactive flags (-y, --yes, DEBIAN_FRONTEND=noninteractive). Never start interactive prompts, TUIs, REPLs, or foreground daemons.`,
    `2. For long-running services, use systemd/pm2/nohup in the background. Set reasonable timeouts (default 60s, max 5 min).`,
    `3. Always provide a concise "description" in the user's language explaining WHY you run each command.`,
    `4. Before destructive operations (rm, DROP, kill -9, etc.), briefly warn the user in your reply.`,
    `5. After tool results, summarize findings for the user clearly. Use Markdown for structure.`,
    `6. If a tool returns status="pending_approval", tell the user the command is queued for approval in the Approval Center.`,
    `7. Reply in the same language the user used (Chinese or English).`,
    `8. Efficiency: When a task needs multiple shell steps that do NOT depend on each other's output, call them in parallel in one round (most providers support parallel tool_calls). When steps ARE sequential and logically related (e.g. configure firewall: reset -> set defaults -> allow ports -> enable), prefer combining them into ONE execute_command using && chaining, rather than one command per round. This keeps tool-call rounds low and is much faster.`,
  ].filter(Boolean).join("\n");
}

function toOpenAIMessages(contextMessages) {
  const msgs = [];
  for (const m of contextMessages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (m.role === "user") {
      msgs.push({ role: "user", content: m.content || "" });
      continue;
    }
    const assistantMsg = { role: "assistant", content: m.content || "" };
    if (m.reasoningContent) assistantMsg.reasoning_content = m.reasoningContent;
    if (Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      assistantMsg.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
      }));
    }
    msgs.push(assistantMsg);
    if (Array.isArray(m.toolCalls)) {
      for (const tc of m.toolCalls) {
        msgs.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(tc.result ?? { error: "No result recorded" }),
        });
      }
    }
  }
  return msgs;
}

async function* streamOpenAIChunks(url, apiKey, body, signal) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`AI API ${resp.status}: ${text.slice(0, 500)}`);
  }
  if (!resp.body) throw new Error("AI API returned empty body.");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload);
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function extractDelta(chunk) {
  return chunk?.choices?.[0]?.delta || chunk?.choices?.[0]?.message || null;
}

async function streamChatCompletion({ ai, messages, tools, emit, messageId }) {
  const url = `${ai.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: ai.model,
    messages,
    temperature: ai.temperature,
    max_tokens: ai.maxTokens,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300_000);

  let content = "";
  let reasoning = "";
  let finishReason = null;
  let reasoningStartedAt = null;
  let reasoningEndedAt = null;
  let contentStartedAt = null;
  const toolCallsByIndex = new Map();

  try {
    for await (const chunk of streamOpenAIChunks(url, ai.apiKey, body, controller.signal)) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = extractDelta(chunk);
      if (!delta) continue;

      const rc = delta.reasoning_content ?? delta.reasoning ?? null;
      if (typeof rc === "string" && rc.length > 0) {
        if (reasoningStartedAt === null) {
          reasoningStartedAt = Date.now();
          emit({ type: "assistant_reasoning_start", messageId });
        }
        reasoning += rc;
        reasoningEndedAt = Date.now();
        emit({ type: "assistant_delta", messageId, field: "reasoning", delta: rc });
      }

      const c = delta.content;
      if (typeof c === "string" && c.length > 0) {
        if (reasoningStartedAt !== null && reasoningEndedAt !== null && contentStartedAt === null) {
          emit({ type: "assistant_reasoning_end", messageId, durationMs: reasoningEndedAt - reasoningStartedAt });
        }
        if (contentStartedAt === null) contentStartedAt = Date.now();
        content += c;
        emit({ type: "assistant_delta", messageId, field: "content", delta: c });
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolCallsByIndex.get(idx) || { id: "", name: "", arguments: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolCallsByIndex.set(idx, existing);
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (reasoningStartedAt !== null && reasoningEndedAt !== null && contentStartedAt === null) {
    emit({ type: "assistant_reasoning_end", messageId, durationMs: reasoningEndedAt - reasoningStartedAt });
  }

  const toolCalls = [...toolCallsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => {
      let args = {};
      try { args = JSON.parse(v.arguments || "{}"); } catch {}
      return {
        id: v.id || `call_${randomBytes(6).toString("hex")}`,
        name: v.name,
        args,
      };
    })
    .filter((tc) => tc.name);

  const reasoningDurationMs = reasoningStartedAt && reasoningEndedAt ? reasoningEndedAt - reasoningStartedAt : 0;

  return { content, reasoning, reasoningDurationMs, toolCalls, finishReason };
}

export async function runChatTurn({ serverId, userMessage, emit }) {
  const ai = getAIConfig();
  if (!ai.apiKey) throw new Error("AI service not configured. Please configure it in AI Config page.");

  const server = getServer(serverId);
  if (!server) throw new Error(`Server not found: ${serverId}`);

  const { message: savedUserMsg } = appendMessage(serverId, { role: "user", content: userMessage });
  emit({ type: "user_message", message: savedUserMsg });

  const system = { role: "system", content: buildSystemPrompt(server) };
  const contextMessages = getChatContext(serverId);
  const messages = [system, ...toOpenAIMessages(contextMessages)];

  const { autoApprove } = getChat(serverId);

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const messageId = randomBytes(6).toString("hex");
    emit({ type: "assistant_start", messageId, timestamp: Date.now(), round: rounds });

    let result;
    try {
      result = await streamChatCompletion({ ai, messages, tools: TOOL_DEFINITIONS, emit, messageId });
    } catch (err) {
      const { message: errMsg } = appendMessage(serverId, {
        role: "assistant",
        content: `AI request failed: ${err.message}`,
        error: true,
      });
      emit({ type: "error", message: errMsg });
      return;
    }

    const hasToolCalls = result.toolCalls.length > 0;

    const assistantRecord = {
      id: messageId,
      role: "assistant",
      content: result.content,
      reasoningContent: result.reasoning || undefined,
      reasoningDurationMs: result.reasoningDurationMs || undefined,
      toolCalls: hasToolCalls ? result.toolCalls.map((tc) => ({ ...tc, result: null })) : undefined,
      timestamp: Date.now(),
    };

    appendMessage(serverId, assistantRecord);
    emit({ type: "assistant_done", messageId, reasoningDurationMs: result.reasoningDurationMs || 0, toolCalls: hasToolCalls ? result.toolCalls.map((tc) => ({ ...tc, result: null })) : [] });

    if (!hasToolCalls) return;

    messages.push({
      role: "assistant",
      content: result.content,
      ...(result.reasoning ? { reasoning_content: result.reasoning } : {}),
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
      })),
    });

    for (const call of result.toolCalls) {
      emit({ type: "tool_call_start", messageId, call });
      const toolResult = await executeTool(serverId, call.name, call.args, {
        autoApprove,
        onEvent: (e) => emit({ type: "tool_event", messageId, callId: call.id, event: e }),
      });

      const persisted = getChat(serverId).messages.find((m) => m.id === messageId);
      if (persisted?.toolCalls) {
        const updatedCalls = persisted.toolCalls.map((c) => (c.id === call.id ? { ...c, result: toolResult } : c));
        updateMessage(serverId, messageId, { toolCalls: updatedCalls });
      }
      emit({ type: "tool_call_result", messageId, callId: call.id, result: toolResult });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(toolResult ?? {}),
      });
    }
  }

  const messageId = randomBytes(6).toString("hex");
  emit({ type: "assistant_start", messageId, timestamp: Date.now(), round: rounds + 1, finalSummary: true });

  messages.push({
    role: "user",
    content:
      `You have reached the ${MAX_TOOL_ROUNDS}-round tool-call limit for this turn. ` +
      `Do not call any more tools. Based on everything you have already executed, write a concise summary for the user: what was accomplished, what is still pending, and the recommended next step. Reply in the user's language.`,
  });

  try {
    const finalResult = await streamChatCompletion({ ai, messages, tools: undefined, emit, messageId });
    appendMessage(serverId, {
      id: messageId,
      role: "assistant",
      content: finalResult.content || `(Reached max tool-call rounds of ${MAX_TOOL_ROUNDS}.)`,
      reasoningContent: finalResult.reasoning || undefined,
      reasoningDurationMs: finalResult.reasoningDurationMs || undefined,
      timestamp: Date.now(),
    });
    emit({ type: "assistant_done", messageId, reasoningDurationMs: finalResult.reasoningDurationMs || 0, toolCalls: [] });
  } catch (err) {
    const { message: errMsg } = appendMessage(serverId, {
      role: "assistant",
      content: `(Reached max tool-call rounds of ${MAX_TOOL_ROUNDS}. Final summary also failed: ${err.message})`,
      error: true,
    });
    emit({ type: "error", message: errMsg });
  }
}

export function toggleAutoApprove(serverId, enabled) {
  return persistAutoApprove(serverId, enabled);
}
