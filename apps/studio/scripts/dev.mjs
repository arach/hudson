/**
 * Studio dev — catalog + Paper (API) on one origin (:3033).
 * Spawns Paper API on :29982 and Vite Studio with /api proxy.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const studioRoot = fileURLToPath(new URL("..", import.meta.url));
const paperRoot = path.resolve(studioRoot, "../../packages/tools/hudson-paper");
const apiPort = Number(process.env.PAPER_API_PORT ?? 29982);
const studioPort = Number(process.env.STUDIO_PORT ?? 3033);

// When this script is launched via `bun run`, execPath is the bun binary.
// Fall back to PATH lookup for node-launched use.
const bunBin =
  process.env.BUN_BIN ||
  (process.execPath && /bun/i.test(process.execPath)
    ? process.execPath
    : existsSync(`${process.env.HOME}/.bun/bin/bun`)
      ? `${process.env.HOME}/.bun/bin/bun`
      : "bun");

const children = [];

function run(cmd, args, opts = {}) {
  const env = {
    ...process.env,
    PATH: `${path.dirname(bunBin)}:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
    ...opts.env,
  };
  // Prefer direct spawn; fall back to /bin/sh -c if the sandbox blocks bun's path.
  let child;
  try {
    child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: opts.cwd ?? studioRoot,
      env,
    });
  } catch {
    const line = [cmd, ...args].map((a) => JSON.stringify(a)).join(" ");
    child = spawn("/bin/sh", ["-c", line], {
      stdio: "inherit",
      cwd: opts.cwd ?? studioRoot,
      env,
    });
  }
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    for (const c of children) {
      if (c !== child && !c.killed) c.kill("SIGTERM");
    }
    process.exit(code ?? 1);
  });
  child.on("error", (err) => {
    console.error(`spawn failed: ${cmd} ${args.join(" ")}`, err.message);
    // Retry via shell once
    if (!opts._retried) {
      const line = [cmd, ...args].map((a) => `'${String(a).replace(/'/g, `'\\''`)}'`).join(" ");
      const sh = spawn("/bin/sh", ["-c", line], {
        stdio: "inherit",
        cwd: opts.cwd ?? studioRoot,
        env,
      });
      children.push(sh);
      sh.on("exit", (code) => process.exit(code ?? 1));
    }
  });
  return child;
}

function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`Paper API  → http://127.0.0.1:${apiPort}  (proxied from Studio /api)`);
console.log(`Studio Flows → http://127.0.0.1:${studioPort}/flows`);

run(
  bunBin,
  [
    "run",
    "src/cli.ts",
    "serve",
    "--api-only",
    "--port",
    String(apiPort),
    "--host",
    "127.0.0.1",
  ],
  { cwd: paperRoot },
);

setTimeout(() => {
  run(
    bunBin,
    ["x", "vite", "--port", String(studioPort), "--host", "127.0.0.1"],
    {
      cwd: studioRoot,
      env: {
        PAPER_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
      },
    },
  );
}, 400);
