#!/usr/bin/env node

import { createServer } from "vite";
import electronPath from "electron";
import { spawn } from "node:child_process";
import {
  DEV_SERVER_PORT,
} from "../vite.config.js";

const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
});
let electron = null;
let shuttingDown = false;

function closeServer() {
  return server.close().catch(() => undefined);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && electron.exitCode === null && !electron.killed) {
    electron.kill("SIGTERM");
  }
  await closeServer();
  process.exitCode = exitCode;
}

try {
  await server.listen();
  const devServerUrl = server.resolvedUrls?.local?.[0];
  if (!devServerUrl) throw new Error("Vite did not expose a local URL");

  electron = spawn(electronPath, ["."], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl,
    },
    stdio: "inherit",
  });
  electron.once("error", async () => {
    await shutdown(1);
  });
  electron.once("exit", async (code, signal) => {
    await shutdown(signal ? 1 : (code ?? 0));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await shutdown(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await shutdown(0);
  });
}
