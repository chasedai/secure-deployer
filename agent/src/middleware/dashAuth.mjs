import { getConfig } from "../utils/config.mjs";
import { verifyPassword, generateSessionToken } from "../utils/security.mjs";

const sessions = new Map();
const SESSION_TTL = 24 * 3600_000; // 24 hours

export function dashAuth(req, res, next) {
  const openPaths = ["/dash/auth/login", "/dash/auth/setup", "/dash/auth/check"];
  if (openPaths.includes(req.path)) return next();

  if (req.path.startsWith("/dash/")) {
    const token = parseCookie(req.headers.cookie, "sd_session");
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Not authenticated. Please login via Dashboard." });
    }
    const session = sessions.get(token);
    if (Date.now() - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
      return res.status(401).json({ error: "Session expired. Please login again." });
    }
    req.session = session;
    return next();
  }

  next();
}

export function createSession() {
  const token = generateSessionToken();
  sessions.set(token, { createdAt: Date.now() });
  setTimeout(() => sessions.delete(token), SESSION_TTL);
  return token;
}

export function isPasswordSet() {
  return !!getConfig().dashPasswordHash;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
