#!/usr/bin/env node
// Fail if a sealed tarball is missing dist/styles.css. With no argument this
// checks the package script's default tarball; release automation may pass the
// path of its immutable, explicitly named artifact.
// Consumer installs (iris gates, pnpm file: deps, npm tgz) all resolve
// `hudsonkit/styles` → dist/styles.css; a pack without it is a red gate.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const required = [
  'package/dist/styles.css',
  'package/dist/tokens.css',
  'package/dist/styles.d.ts',
  'package/dist/styles-tokens.d.ts',
  'package/dist/agent-composer.js',
  'package/dist/agent-composer.d.ts',
  'package/dist/agent-composer.css',
  'package/dist/agent-composer-styles.d.ts',
  'package/dist/agent-workspace.js',
  'package/dist/agent-workspace.d.ts',
  'package/dist/agent-workspace.css',
  'package/dist/agent-workspace-styles.d.ts',
];

const packageJson = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
const defaultTarball = `hudsonkit-${packageJson.version}.tgz`;
const tarballPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(pkgRoot, defaultTarball);
const tarball = basename(tarballPath);

if (!existsSync(tarballPath)) {
  process.stderr.write(`[hudsonkit] verify-pack: expected ${tarballPath}\n`);
  process.exit(1);
}

const listed = spawnSync('tar', ['-tzf', tarballPath], {
  encoding: 'utf8',
});

if (listed.error || listed.status !== 0) {
  process.stderr.write(`[hudsonkit] verify-pack: failed to list ${tarball}\n`);
  process.stderr.write(listed.stderr || listed.error?.message || '');
  process.exit(listed.status ?? 1);
}

const entries = new Set(listed.stdout.split('\n').filter(Boolean));
const missing = required.filter((path) => !entries.has(path));

if (missing.length > 0) {
  process.stderr.write(
    `[hudsonkit] verify-pack: ${tarball} is missing required CSS package files:\n` +
      missing.map((path) => `  - ${path}\n`).join('') +
      'Run `bun run build:css` before pack, and ensure tsup clean preserves styles.css.\n',
  );
  process.exit(1);
}

process.stdout.write(`[hudsonkit] verify-pack: ${tarball} includes styles.css ✓\n`);
