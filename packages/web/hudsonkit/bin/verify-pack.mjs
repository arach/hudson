#!/usr/bin/env node
// Fail the pack script if the sealed tarball is missing dist/styles.css.
// Consumer installs (iris gates, pnpm file: deps, npm tgz) all resolve
// `hudsonkit/styles` → dist/styles.css; a pack without it is a red gate.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const required = [
  'package/dist/styles.css',
  'package/dist/tokens.css',
  'package/dist/styles.d.ts',
  'package/dist/styles-tokens.d.ts',
];

// Prefer the exact version from package.json so a stale higher-version leftover
// cannot win over the tarball `bun pm pack` just emitted (lexicographic last
// is wrong when e.g. 0.4.0 and 0.3.9 coexist — or when a stray 9.x sits around).
const pkgVersion = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version;
const expectedName = `hudsonkit-${pkgVersion}.tgz`;
const expectedPath = join(pkgRoot, expectedName);

let tarball = expectedName;
if (!existsSync(expectedPath)) {
  const tarballs = readdirSync(pkgRoot)
    .filter((name) => /^hudsonkit-.*\.tgz$/.test(name))
    .sort();
  if (tarballs.length === 0) {
    process.stderr.write(
      `[hudsonkit] verify-pack: expected ${expectedName} (from package.json version ${pkgVersion}) — none found\n`,
    );
    process.exit(1);
  }
  process.stderr.write(
    `[hudsonkit] verify-pack: ${expectedName} missing; falling back to lexicographically-last of ${tarballs.length} tarball(s)\n`,
  );
  tarball = tarballs[tarballs.length - 1];
}

const listed = spawnSync('tar', ['-tzf', join(pkgRoot, tarball)], {
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
