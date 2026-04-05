import rateLimit from "express-rate-limit";
import { getConfig } from "../utils/config.mjs";

export function createApiRateLimit() {
  const { rateLimit: rl } = getConfig();
  return rateLimit({
    windowMs: rl.windowMs,
    max: rl.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Rate limit exceeded. Max ${rl.max} requests per ${rl.windowMs / 1000}s.` },
  });
}
