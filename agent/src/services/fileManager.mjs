import {
  readFileSync, writeFileSync, readdirSync, statSync,
  unlinkSync, rmSync, existsSync, mkdirSync,
} from "node:fs";
import { join, resolve, dirname, basename, extname } from "node:path";
import { homedir } from "node:os";

const FORBIDDEN_PATHS = ["/proc", "/sys", "/dev", "/boot"];

function safePath(requestedPath) {
  const resolved = resolve(requestedPath);
  if (FORBIDDEN_PATHS.some((fp) => resolved.startsWith(fp))) {
    throw new Error(`Access denied: ${resolved}`);
  }
  return resolved;
}

export function listDirectory(dirPath) {
  const p = safePath(dirPath || homedir());
  const entries = readdirSync(p, { withFileTypes: true });
  return entries.map((e) => {
    const fullPath = join(p, e.name);
    let stat = null;
    try { stat = statSync(fullPath); } catch { /* skip */ }
    return {
      name: e.name,
      path: fullPath,
      isDirectory: e.isDirectory(),
      size: stat?.size || 0,
      modified: stat?.mtime?.toISOString() || null,
    };
  }).sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function readFile(filePath) {
  const p = safePath(filePath);
  const stat = statSync(p);
  if (stat.size > 5 * 1024 * 1024) {
    throw new Error("File too large (>5MB). Use download instead.");
  }
  const content = readFileSync(p, "utf-8");
  return { path: p, content, size: stat.size, modified: stat.mtime.toISOString() };
}

export function writeFile(filePath, content) {
  const p = safePath(filePath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf-8");
  const stat = statSync(p);
  return { path: p, size: stat.size, modified: stat.mtime.toISOString() };
}

export function deleteFileOrDir(targetPath) {
  const p = safePath(targetPath);
  if (!existsSync(p)) throw new Error(`Path not found: ${p}`);
  const stat = statSync(p);
  if (stat.isDirectory()) {
    rmSync(p, { recursive: true, force: true });
  } else {
    unlinkSync(p);
  }
  return { path: p, deleted: true };
}

export function getFileStat(filePath) {
  const p = safePath(filePath);
  const stat = statSync(p);
  return {
    path: p,
    name: basename(p),
    ext: extname(p),
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
  };
}

export async function performFileOperation(type, request) {
  switch (type) {
    case "file_write":
      return writeFile(request.path, request.content);
    case "file_delete":
      return deleteFileOrDir(request.path);
    case "file_upload":
      return { path: request.destPath, size: request.size, uploaded: true };
    default:
      throw new Error(`Unknown file operation: ${type}`);
  }
}
