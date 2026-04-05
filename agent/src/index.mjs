import { initConfig, getConfig } from "./utils/config.mjs";
import { initHistory } from "./services/history.mjs";
import { createApiServer } from "./apiServer.mjs";
import { createDashServer } from "./dashServer.mjs";

console.log("=".repeat(60));
console.log("  Secure Deployer Agent — Starting...");
console.log("=".repeat(60));

const config = initConfig();
initHistory();

const apiApp = createApiServer();
const dashApp = createDashServer();

apiApp.listen(config.apiPort, "0.0.0.0", () => {
  console.log(`  [API]       http://0.0.0.0:${config.apiPort}  (AI 调用端口)`);
});

dashApp.listen(config.dashPort, "0.0.0.0", () => {
  console.log(`  [Dashboard] http://0.0.0.0:${config.dashPort}  (管理界面端口)`);
});

console.log("");
console.log(`  API Key:    ${config.apiKey}`);
console.log(`  执行模式:   ${config.executionMode === "approval" ? "审批模式（AI 命令需审批）" : "直接执行模式"}`);
console.log("=".repeat(60));
