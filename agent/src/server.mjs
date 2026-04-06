import express from "express";
import { apiAuth } from "./middleware/apiAuth.mjs";
import { manageAuth } from "./middleware/manageAuth.mjs";
import { createApiRateLimit } from "./middleware/rateLimit.mjs";
import { requestLogger } from "./middleware/logger.mjs";
import execRouter from "./routes/exec.mjs";
import tasksRouter from "./routes/tasks.mjs";
import filesRouter from "./routes/files.mjs";
import systemRouter from "./routes/system.mjs";
import manageRouter from "./routes/manage.mjs";

export function createServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(requestLogger("AGENT"));

  const api = express.Router();
  api.use(createApiRateLimit());
  api.use(apiAuth);
  api.use(execRouter);
  api.use(tasksRouter);
  api.use(filesRouter);
  api.use(systemRouter);
  app.use("/api", api);

  const manage = express.Router();
  manage.use(manageAuth);
  manage.use(manageRouter);
  app.use("/manage", manage);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
