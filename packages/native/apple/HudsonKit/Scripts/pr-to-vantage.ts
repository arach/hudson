#!/usr/bin/env bun
// Generate a Vantage setup manifest from a GitHub PR.
//
// Usage:
//   pr-to-vantage.ts <pr-number-or-url> [--out <dir>] [--repo <owner/name>]
//
// Output:
//   <out>/diffs/<safe-path>.diff      one unified diff per file
//   <out>/pr-<n>.setup.json           hudson.vantage.setup manifest
//
// Open the manifest in Vantage with:
//   vantagectl.sh --wait restore-workspace --state-file <out>/pr-<n>.setup.json --create

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface PrFile {
  path: string;
  additions: number;
  deletions: number;
}

interface PrInfo {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  files: PrFile[];
  author: { login: string };
  url: string;
}

function gh(args: string[]): string {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
}

function fetchPr(prRef: string, repo: string | null): PrInfo {
  const args = [
    "pr",
    "view",
    prRef,
    "--json",
    "number,title,headRefName,baseRefName,files,author,url",
  ];
  if (repo) args.push("--repo", repo);
  return JSON.parse(gh(args)) as PrInfo;
}

function fetchDiff(prRef: string, repo: string | null): string {
  const args = ["pr", "diff", prRef];
  if (repo) args.push("--repo", repo);
  return gh(args);
}

function splitDiff(diff: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = diff.split("\n");
  let current: string | null = null;
  let buffer: string[] = [];
  const header = /^diff --git a\/(.+) b\/(.+)$/;
  for (const line of lines) {
    const m = line.match(header);
    if (m) {
      if (current !== null) out.set(current, buffer.join("\n"));
      current = m[2];
      buffer = [line];
    } else if (current !== null) {
      buffer.push(line);
    }
  }
  if (current !== null) out.set(current, buffer.join("\n"));
  return out;
}

function safeName(p: string): string {
  return p.replace(/[\/\\]/g, "__").replace(/[^A-Za-z0-9._-]/g, "_");
}

function gridLayout(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const w = 640;
  const h = 400;
  const gx = 60;
  const gy = 60;
  const totalW = cols * w + (cols - 1) * gx;
  const totalH = rows * h + (rows - 1) * gy;
  const x0 = -totalW / 2;
  const y0 = -totalH / 2;
  const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    positions.push({
      x: x0 + c * (w + gx),
      y: y0 + r * (h + gy),
      width: w,
      height: h,
    });
  }
  return positions;
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    console.error(
      "usage: pr-to-vantage <pr-number-or-url> [--out <dir>] [--repo <owner/name>]"
    );
    process.exit(args.length === 0 ? 1 : 0);
  }
  let prRef = "";
  let out: string | null = null;
  let repo: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--out") out = args[++i];
    else if (a === "--repo") repo = args[++i];
    else if (!prRef) prRef = a;
    else {
      console.error(`unexpected argument: ${a}`);
      process.exit(1);
    }
  }
  return { prRef, out, repo };
}

function main() {
  const { prRef, out, repo } = parseArgs(process.argv);

  console.error(`fetching PR ${prRef}${repo ? ` (${repo})` : ""}...`);
  const pr = fetchPr(prRef, repo);
  const diff = fetchDiff(prRef, repo);
  const fileDiffs = splitDiff(diff);

  const dir = resolve(out ?? `/tmp/vantage-pr-${pr.number}`);
  const diffsDir = resolve(dir, "diffs");
  mkdirSync(diffsDir, { recursive: true });

  const files = pr.files.filter((f) => fileDiffs.has(f.path));
  const skipped = pr.files.length - files.length;
  if (skipped > 0) {
    console.error(`  (skipped ${skipped} files with no diff content — likely binary)`);
  }
  if (files.length === 0) {
    console.error("no diff content found; nothing to render");
    process.exit(1);
  }

  // Significance heuristic: top quartile by total lines changed = "focus".
  const totals = files.map((f) => f.additions + f.deletions);
  const sorted = [...totals].sort((a, b) => b - a);
  const focusThreshold = sorted[Math.max(0, Math.floor(sorted.length / 4) - 1)] ?? 0;

  // Sort files by directory then path so siblings cluster spatially.
  const ordered = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const positions = gridLayout(ordered.length);

  const nodes = ordered.map((f, i) => {
    const total = f.additions + f.deletions;
    const isFocus = total >= focusThreshold && total > 0;
    const safe = safeName(f.path);
    const diffPath = resolve(diffsDir, `${safe}.diff`);
    writeFileSync(diffPath, fileDiffs.get(f.path) ?? "");
    return {
      id: `pr.${pr.number}.${safe}`,
      runtimeKind: "diff",
      path: diffPath,
      title: f.path,
      subtitle: `+${f.additions} -${f.deletions} lines`,
      language: "diff",
      role: "pr",
      tag: isFocus ? "focus" : "watch",
      ...positions[i],
      zIndex: i + 1,
    };
  });

  const focusIds = nodes.filter((n) => n.tag === "focus").map((n) => n.id);

  const manifest = {
    kind: "hudson.vantage.setup",
    schemaVersion: 1,
    workspaceID: `vantage-pr-${pr.number}`,
    surfaceTitle: `PR #${pr.number} · ${pr.title}`,
    createIfMissing: true,
    removeMissing: true,
    presentation: {
      title: `PR #${pr.number}`,
      subtitle: pr.title,
      badge: `${pr.headRefName} → ${pr.baseRefName}`,
      cobrand: `by @${pr.author.login}`,
      productName: "Vantage",
      hostName: "HudsonKit",
      theme: "jade",
      accent: "cyan",
    },
    style: {
      preset: "jade",
      canvasGridMode: "dots",
      canvasGridStep: 18,
      focusPadding: 12,
    },
    viewport: { fit: true },
    layout: {
      canvasTool: "select",
      navigationFilter: "all",
      minimapCollapsed: false,
      inspectorCollapsed: false,
      navigationWidth: 250,
      inspectorWidth: 310,
    },
    nodes,
    selection: focusIds,
  };

  const setupPath = resolve(dir, `pr-${pr.number}.setup.json`);
  writeFileSync(setupPath, JSON.stringify(manifest, null, 2));

  console.error(`  ${nodes.length} nodes  ·  ${focusIds.length} tagged focus`);
  console.error(`  manifest: ${setupPath}`);
  console.error(`  diffs:    ${diffsDir}`);
  console.error("");
  console.error("  open in TerminiCanvas:");
  console.error(
    `    HUDSON_VANTAGE_CONTROL_FILE=/tmp/termini-canvas-control.jsonl \\`
  );
  console.error(
    `    HUDSON_VANTAGE_RESPONSE_FILE=/tmp/termini-canvas-control.responses.jsonl \\`
  );
  console.error(
    `    HUDSON_VANTAGE_STATE_FILE=/tmp/termini-canvas-state.json \\`
  );
  console.error(
    `    packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait setup \\`
  );
  console.error(
    `      --manifest ${setupPath} --create --remove-missing --fit`
  );
  console.log(setupPath);
}

main();
