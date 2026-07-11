import * as proxy from "./agentProxy.mjs";
import { getAgentConfig } from "./agentProxy.mjs";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "execute_command",
      description:
        "Run a shell command on the remote server and return stdout/stderr. " +
        "ALWAYS use non-interactive flags (e.g. -y, --yes, DEBIAN_FRONTEND=noninteractive). " +
        "Never start interactive TUIs, REPLs, or long-running daemons. Use -n/--non-interactive when possible.",
      parameters: {
        type: "object",
        properties: {
          cmd: { type: "string", description: "The shell command to run." },
          description: {
            type: "string",
            description:
              "A clear, user-facing explanation (in the user's language) of WHY this command is being run, what it does, and any risks.",
          },
          cwd: { type: "string", description: "Optional working directory." },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds. Default 60000. Max 300000.",
          },
        },
        required: ["cmd", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file on the remote server (text files only, size limits apply).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path of the file to read." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a file on the remote server.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path of the file to write." },
          content: { type: "string", description: "Full file contents." },
          description: {
            type: "string",
            description: "A clear explanation of why this file is being written.",
          },
        },
        required: ["path", "content", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file on the remote server. Use with extreme caution.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path of the file to delete." },
          description: { type: "string", description: "Why this file is being deleted." },
        },
        required: ["path", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files in a directory on the remote server.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute directory path." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_info",
      description:
        "Get basic system information of the remote server: OS, kernel, CPU, memory, disk, uptime, current user.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const POLL_INTERVAL = 1000;
const MAX_POLL = 180;

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function approveAndPoll(serverId, taskId, { onEvent, autoApprove }) {
  let polls = 0;
  let approved = false;

  while (polls < MAX_POLL) {
    let task;
    try {
      const res = await proxy.getTask(serverId, taskId);
      task = res.task || res;
    } catch (err) {
      return { error: `Failed to poll task: ${err.message}` };
    }

    if (!approved && task.status === "pending_approval" && autoApprove) {
      try {
        await proxy.approveTask(serverId, taskId);
        approved = true;
        onEvent?.({ type: "task_approved", taskId });
      } catch (err) {
        return { error: `Auto-approve failed: ${err.message}` };
      }
    }

    if (task.status === "completed") {
      return { status: "completed", task };
    }
    if (task.status === "failed") {
      return { status: "failed", task, error: task.result?.error || "Task failed" };
    }
    if (task.status === "rejected") {
      return { status: "rejected", task, error: "User rejected the task" };
    }
    if (task.status === "blocked") {
      return { status: "blocked", task, error: "Command blocked by security policy" };
    }

    onEvent?.({ type: "task_status", taskId, status: task.status });
    polls++;
    await sleep(POLL_INTERVAL);
  }
  return { error: "Task poll timeout (3 min). Task may still be running." };
}

export async function executeTool(serverId, toolName, args, { autoApprove, onEvent }) {
  try {
    switch (toolName) {
      case "execute_command": {
        const { cmd, description, cwd, timeout } = args;
        if (!cmd) return { error: "cmd is required" };
        if (!description) return { error: "description is required" };

        const submitted = await proxy.execCommand(serverId, {
          cmd,
          description,
          cwd,
          timeout: Math.min(timeout || 60000, 300000),
        });

        onEvent?.({ type: "task_created", taskId: submitted.taskId, status: submitted.status, cmd, description });

        if (submitted.status === "completed") {
          const r = submitted.result || {};
          return {
            status: "completed",
            exitCode: r.exitCode,
            stdout: truncate(r.stdout, 8000),
            stderr: truncate(r.stderr, 4000),
            durationMs: r.durationMs,
          };
        }

        const polled = await approveAndPoll(serverId, submitted.taskId, { onEvent, autoApprove });
        if (polled.error) return { error: polled.error, status: polled.status };
        const r = polled.task.result || {};
        return {
          status: polled.status,
          exitCode: r.exitCode,
          stdout: truncate(r.stdout, 8000),
          stderr: truncate(r.stderr, 4000),
          durationMs: r.durationMs,
        };
      }
      case "read_file": {
        const r = await proxy.filesRead(serverId, args.path);
        return { path: args.path, content: truncate(r.content || "", 16000), truncated: (r.content || "").length > 16000 };
      }
      case "write_file": {
        const { path, content, description } = args;
        const submitted = await proxy.filesWrite(serverId, path, content, description);
        onEvent?.({ type: "task_created", taskId: submitted.taskId, status: submitted.status, path, description });
        if (submitted.status === "completed") return { status: "completed", path };
        const polled = await approveAndPoll(serverId, submitted.taskId, { onEvent, autoApprove });
        return polled.error ? { error: polled.error, status: polled.status } : { status: polled.status, path };
      }
      case "delete_file": {
        const { path, description } = args;
        const submitted = await proxy.filesDelete(serverId, path, description);
        onEvent?.({ type: "task_created", taskId: submitted.taskId, status: submitted.status, path, description });
        if (submitted.status === "completed") return { status: "completed", path };
        const polled = await approveAndPoll(serverId, submitted.taskId, { onEvent, autoApprove });
        return polled.error ? { error: polled.error, status: polled.status } : { status: polled.status, path };
      }
      case "list_directory": {
        const r = await proxy.filesList(serverId, args.path);
        return { path: args.path, entries: r.entries || r.items || r };
      }
      case "get_system_info": {
        try {
          return await proxy.getSystemInfoAI(serverId);
        } catch {
          return await getAgentConfig(serverId).then(() => proxy.getSystemInfo(serverId));
        }
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

function truncate(s, max) {
  if (typeof s !== "string") return s;
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n...[truncated, ${s.length - max} more chars]`;
}
