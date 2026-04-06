import { getConfig } from "../utils/config.mjs";

export function manageAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header. Use: Bearer <MANAGEMENT_SECRET>" });
  }

  const token = authHeader.slice(7);
  if (token !== getConfig().managementSecret) {
    return res.status(403).json({ error: "Invalid management secret" });
  }

  next();
}
