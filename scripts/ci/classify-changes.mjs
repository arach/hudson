#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SURFACES = {
  workflows: [
    ".github/workflows/**",
    ".github/ci-surfaces.json",
    "scripts/ci/**",
  ],
  web: [
    "web/**",
    "app/**",
    "apps/**",
    "docs/**",
    "marketing/**",
    "packages/web/**",
    "public/**",
    "scripts/**",
    "site/**",
    "types/**",
    "bun.lock",
    "eslint.config.mjs",
    "next.config.ts",
    "package.json",
    "postcss.config.mjs",
    "tsconfig.json",
    "tsconfig.tests.json",
    "vitest.config.ts",
  ],
  native: [
    "native/**",
    "packages/native/**",
    "Package.resolved",
    "Package.swift",
  ],
  cloud: [
    "cloud/**",
    "cloudflare-static-worker.ts",
    "drizzle/**",
    "drizzle.config.ts",
    "embed-worker/**",
    "packages/cloud/**",
    "packages/services/**",
    "wrangler.jsonc",
  ],
};

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  args.set(arg.slice(2), process.argv[i + 1]);
  i += 1;
}

function sh(command, commandArgs) {
  return execFileSync(command, commandArgs, { encoding: "utf8" }).trim();
}

function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function resolveRange() {
  if (args.has("base") && args.has("head")) {
    return { base: args.get("base"), head: args.get("head") };
  }

  const event = readEvent();
  if (event.pull_request) {
    return {
      base: event.pull_request.base?.sha,
      head: event.pull_request.head?.sha,
    };
  }

  if (event.before && event.after && !/^0+$/.test(event.before)) {
    return { base: event.before, head: event.after };
  }

  const head = event.after || process.env.GITHUB_SHA || "HEAD";
  try {
    return { base: sh("git", ["merge-base", "origin/main", head]), head };
  } catch {
    return { base: `${head}^`, head };
  }
}

function changedFiles(base, head) {
  if (!base || !head) return [];
  try {
    return sh("git", ["diff", "--name-only", base, head])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return sh("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", head])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

function matches(pattern, file) {
  if (pattern.endsWith("/**")) {
    return file.startsWith(pattern.slice(0, -3));
  }
  return file === pattern;
}

const eventName = process.env.GITHUB_EVENT_NAME || "";
const forceAll = eventName === "workflow_call";
const { base, head } = resolveRange();
const files = forceAll ? ["__workflow_call__"] : changedFiles(base, head);
const results = Object.fromEntries(Object.keys(SURFACES).map((key) => [key, forceAll]));

if (!forceAll) {
  for (const file of files) {
    for (const [surface, patterns] of Object.entries(SURFACES)) {
      if (patterns.some((pattern) => matches(pattern, file))) {
        results[surface] = true;
      }
    }
  }
}

results.any = Object.values(results).some(Boolean);

console.log(`Compared ${base || "(unknown)"}..${head || "(unknown)"}`);
console.log(`Changed files (${files.length}):`);
for (const file of files) console.log(`- ${file}`);
console.log("Surfaces:");
for (const [surface, value] of Object.entries(results)) {
  console.log(`- ${surface}: ${value}`);
}

if (process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(results).map(([key, value]) => `${key}=${value ? "true" : "false"}`);
  lines.push(`files<<EOF\n${files.join("\n")}\nEOF`);
  execFileSync("sh", ["-c", `cat >> "$GITHUB_OUTPUT"`], {
    input: `${lines.join("\n")}\n`,
    env: process.env,
  });
}
