import express from "express";
import { apiAuth } from "./middleware/apiAuth.mjs";
import { createApiRateLimit } from "./middleware/rateLimit.mjs";
import { requestLogger } from "./middleware/logger.mjs";
import execRouter from "./routes/exec.mjs";
import tasksRouter from "./routes/tasks.mjs";
import filesRouter from "./routes/files.mjs";
import systemRouter from "./routes/system.mjs";

export function createApiServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(requestLogger("API"));
  app.use(createApiRateLimit());
  app.use(apiAuth);

  app.use("/api", execRouter);
  app.use("/api", tasksRouter);
  app.use("/api", filesRouter);
  app.use("/api", systemRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found. This is the AI API port. Dashboard is on a separate port." });
  });

  return app;
}
