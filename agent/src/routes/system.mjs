import { Router } from "express";
import { cpus, totalmem, freemem, uptime, hostname, platform, release, arch } from "node:os";
import { execSync } from "node:child_process";

const router = Router();

router.get("/system", (_req, res) => {
  try {
    const cpuInfo = cpus();
    const cpuUsage = getCpuUsage(cpuInfo);
    const totalMem = totalmem();
    const freeMem = freemem();

    let diskInfo = [];
    try {
      const dfOutput = execSync("df -h --output=target,size,used,avail,pcent 2>/dev/null || df -h", {
        encoding: "utf-8",
        timeout: 5000,
      });
      diskInfo = parseDfOutput(dfOutput);
    } catch { /* non-critical */ }

    res.json({
      hostname: hostname(),
      platform: platform(),
      release: release(),
      arch: arch(),
      uptime: uptime(),
      cpu: {
        model: cpuInfo[0]?.model || "Unknown",
        cores: cpuInfo.length,
        usage: cpuUsage,
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      disk: diskInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

function getCpuUsage(cpuInfo) {
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpuInfo) {
    for (const type of Object.values(cpu.times)) totalTick += type;
    totalIdle += cpu.times.idle;
  }
  return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}

function parseDfOutput(output) {
  const lines = output.trim().split("\n").slice(1);
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) return null;
      return {
        mount: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: parts[4],
      };
    })
    .filter(Boolean)
    .filter((d) => d.mount.startsWith("/"));
}

export default router;
