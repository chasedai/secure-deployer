import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dashAuth } from "./middleware/dashAuth.mjs";
import { requestLogger } from "./middleware/logger.mjs";
import dashApiRouter from "./routes/dashApi.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDashServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(requestLogger("DASH"));
  app.use(dashAuth);

  app.use("/dash", dashApiRouter);

  const publicDir = join(__dirname, "..", "public");
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      const indexPath = join(publicDir, "index.html");
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(placeholderHtml());
      }
    });
  } else {
    app.get("*", (_req, res) => res.send(placeholderHtml()));
  }

  return app;
}

function placeholderHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Secure Deployer</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0}
.box{text-align:center;max-width:500px;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#94a3b8;line-height:1.6}code{background:#1e293b;padding:2px 8px;border-radius:4px}</style></head>
<body><div class="box"><h1>Secure Deployer</h1><p>Dashboard not built yet. Run in project root:<br><code>npm run build</code></p></div></body></html>`;
}
