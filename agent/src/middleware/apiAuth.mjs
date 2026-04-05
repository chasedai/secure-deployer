import { getConfig } from "../utils/config.mjs";

export function apiAuth(req, res, next) {
  if (req.path === "/api/health") return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header. Use: Bearer <API_KEY>" });
  }

  const token = authHeader.slice(7);
  if (token !== getConfig().apiKey) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}
