import { exec, spawn } from "node:child_process";
import { getConfig } from "../utils/config.mjs";

export function executeCommand({ cmd, cwd, timeout, env }) {
  const config = getConfig();
  const execCwd = cwd || config.defaultCwd;
  const execTimeout = Math.min(timeout || 60_000, config.maxTimeout);
  const execEnv = { ...process.env, ...env };

  return new Promise((resolve) => {
    const start = Date.now();
    exec(cmd, {
      timeout: execTimeout,
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/bash",
      cwd: execCwd,
      env: execEnv,
    }, (error, stdout, stderr) => {
      resolve({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout || "",
        stderr: stderr || "",
        killed: error?.killed || false,
        duration: Date.now() - start,
      });
    });
  });
}

export function executeCommandStream({ cmd, cwd, timeout, env }, onData, onClose) {
  const config = getConfig();
  const execCwd = cwd || config.defaultCwd;
  const execTimeout = Math.min(timeout || 60_000, config.maxTimeout);
  const execEnv = { ...process.env, ...env };

  const child = spawn("/bin/bash", ["-c", cmd], {
    cwd: execCwd,
    env: execEnv,
  });

  const timer = setTimeout(() => {
    child.kill("SIGTERM");
  }, execTimeout);

  const start = Date.now();

  child.stdout.on("data", (chunk) => onData("stdout", chunk.toString()));
  child.stderr.on("data", (chunk) => onData("stderr", chunk.toString()));

  child.on("close", (code) => {
    clearTimeout(timer);
    onClose({
      exitCode: code ?? 1,
      duration: Date.now() - start,
    });
  });

  child.on("error", (err) => {
    clearTimeout(timer);
    onClose({
      exitCode: 1,
      duration: Date.now() - start,
      error: err.message,
    });
  });

  return child;
}
