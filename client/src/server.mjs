import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import localApiRouter from "./routes/localApi.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`[CLIENT] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  app.use("/local", localApiRouter);

  const publicDir = join(__dirname, "..", "public");
  if (existsSync(publicDir) && existsSync(join(publicDir, "index.html"))) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(join(publicDir, "index.html"));
    });
  } else {
    app.get("*", (_req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Secure Deployer</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f7;color:#1d1d1f}
.box{text-align:center;max-width:500px;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#86868b;line-height:1.6}code{background:#e8e8ed;padding:2px 8px;border-radius:4px}</style></head>
<body><div class="box"><h1>Secure Deployer</h1><p>Dashboard not built yet. Run in project root:<br><code>npm run build</code></p></div></body></html>`);
    });
  }

  return app;
}
