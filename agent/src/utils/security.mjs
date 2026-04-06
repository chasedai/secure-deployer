import { randomBytes, createHash } from "node:crypto";

export function generateApiKey() {
  return "sk-" + randomBytes(24).toString("hex");
}

export function generateManagementSecret() {
  return "ms-" + randomBytes(24).toString("hex");
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function isCommandBlacklisted(cmd, blacklist) {
  const normalized = cmd.trim().toLowerCase();
  return blacklist.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[\\s;|&])${escaped}(?:$|[\\s;|&/])`, "i");
    return re.test(normalized);
  });
}

export function matchedBlacklistPatterns(cmd, blacklist) {
  const normalized = cmd.trim().toLowerCase();
  return blacklist.filter((pattern) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[\\s;|&])${escaped}(?:$|[\\s;|&/])`, "i");
    return re.test(normalized);
  });
}
