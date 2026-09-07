#!/usr/bin/env node
// hudsonkit prepare hook — runs on `bun install` / `npm install` whenever this
// package is installed from source (git URL, file:/link: to a folder, etc.).
// Workspace installs skip this script because bun/npm don't run prepare for
// linked workspace packages.
//
// Responsibilities:
//   - If dist/ is already populated (typical for npm tarballs), do nothing.
//   - Otherwise, build the package so dist/index.js + dist/styles.css are
//     present at first import. This is the safe path for the
//     `file:../hudsonkit-folder` consumer pattern that lacks dist/.
//
// We deliberately do NOT run a watcher here — only a one-shot build.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(__dirname); // bin/ is one level under the package root

const distIndex = join(pkgRoot, 'dist', 'index.js');
const distStyles = join(pkgRoot, 'dist', 'styles.css');

// If dist/ is already populated, we're inside an npm-tarball install — skip.
if (existsSync(distIndex) && existsSync(distStyles)) {
  process.exit(0);
}

// Inside the Hudson monorepo workspace, bun typically skips `prepare`, but if
// it ever doesn't, refuse to spin up the build during a Hudson workspace
// install — that's an in-place rebuild while devs may be running watchers.
// Heuristic: a `pnpm-workspace.yaml` or root `package.json` with a `workspaces`
// entry pointing at us at a parent directory is the signal.
let parent = dirname(pkgRoot);
let foundWorkspaceRoot = false;
for (let i = 0; i < 6 && parent !== dirname(parent); i++) {
  const candidate = join(parent, 'package.json');
  if (existsSync(candidate)) {
    try {
      const data = JSON.parse(readFileSync(candidate, 'utf8'));
      if (Array.isArray(data?.workspaces)) {
        foundWorkspaceRoot = true;
        break;
      }
    } catch {}
  }
  parent = dirname(parent);
}
if (foundWorkspaceRoot) {
  // We're being prepared inside someone's workspace (likely Hudson itself).
  // Don't auto-build. Devs are expected to run `bun run build` explicitly.
  process.stdout.write('[hudsonkit] prepare: skipped (workspace install)\n');
  process.exit(0);
}

// Otherwise: file:/git install of a source folder. Build now.
process.stdout.write('[hudsonkit] prepare: building dist/ (one-shot)…\n');
const result = spawnSync('bun', ['run', 'build'], {
  cwd: pkgRoot,
  stdio: 'inherit',
});

if (result.error || result.status !== 0) {
  process.stderr.write(
    '\n[hudsonkit] prepare: build failed. ' +
    'If you intended to depend on a Hudson source folder, run `bun run build` ' +
    'inside the hudsonkit package once and retry your install, or switch to a ' +
    'sealed tarball (`bun run pack` produces hudsonkit-X.Y.Z.tgz).\n',
  );
  process.exit(result.status ?? 1);
}
