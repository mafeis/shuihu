#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

const previewPort = await freePort();
const debugPort = await freePort();
const origin = `http://127.0.0.1:${previewPort}`;
let preview = null;
let test = null;

try {
  preview = spawn(
    "npm",
    [
      "run",
      "preview",
      "--",
      "--port",
      String(previewPort),
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  preview.stdout.pipe(process.stderr);
  preview.stderr.pipe(process.stderr);
  await waitForHttp(origin);

  test = spawn(process.execPath, ["tools/e2e_smoke.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      GAME_ORIGIN: origin,
      CHROME_DEBUG_PORT: String(debugPort),
      EXPECT_WEB_APP: "1",
    },
  });
  const exitCode = await new Promise((resolve, reject) => {
    test.once("error", reject);
    test.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Browser release test exited with ${signal}`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await stopProcess(test);
  await stopProcess(preview);
}
