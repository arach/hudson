#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// studio-dev — register this repo's dev server with the local Studio host, then
// run the real dev command.
// ─────────────────────────────────────────────────────────────────────────────
// The Studio host owns a persistent loopback edge and publishes one stable
// hostname per repo:
//
//   http://hudson.studio.local   →   127.0.0.1:3500
//
// Bare `next dev` never registers a hostname, so `bun dev` wraps itself with
// `studio dev`. Studio is a sibling repo, not a published package, so it may
// simply be absent on a fresh clone — in that case this shim degrades to
// running the dev command unwrapped (same behaviour as `bun run dev:raw`).
//
// Usage:  node scripts/studio-dev.mjs --port 3500 -- <command…>
// Knobs:  STUDIO_CLI=/path/to/studio.mjs   force a specific CLI
//         HUDSON_SKIP_STUDIO=1             skip registration entirely
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const flags = sep === -1 ? argv : argv.slice(0, sep);
const command = sep === -1 ? [] : argv.slice(sep + 1);

if (command.length === 0) {
  console.error("studio-dev: no command given (expected `-- <command…>`)");
  process.exit(2);
}

const resolveStudioCli = () => {
  if (process.env.HUDSON_SKIP_STUDIO === "1") return null;
  const candidates = [
    process.env.STUDIO_CLI,
    join(repoRoot, "node_modules", ".bin", "studio"),
    join(repoRoot, "..", "studio", "bin", "studio.mjs"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const cli = resolveStudioCli();

const [bin, ...rest] = cli
  ? ["bun", cli, "dev", ...flags, "--", ...command]
  : command;

if (!cli) {
  console.warn(
    "studio-dev: Studio CLI not found — running unwrapped (no *.studio.local hostname).",
  );
}

const child = spawn(bin, rest, { stdio: "inherit", cwd: repoRoot });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
