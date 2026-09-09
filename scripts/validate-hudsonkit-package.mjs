#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = 'packages/web/hudsonkit';
const artifactDir = mkdtempSync(join(tmpdir(), 'hudsonkit-package-'));
const tarball = join(artifactDir, 'hudsonkit.tgz');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} failed`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

try {
  run('bun', ['run', '--cwd', packageRoot, 'build']);
  run('bun', ['run', '--cwd', packageRoot, 'assert-dist']);
  run('bun', [
    'pm',
    'pack',
    '--cwd',
    packageRoot,
    '--filename',
    tarball,
    '--quiet',
  ]);
  run('node', [join(packageRoot, 'bin/verify-pack.mjs'), tarball]);
  run('bunx', ['publint', tarball]);
  run('bunx', [
    'attw',
    tarball,
    '--profile',
    'esm-only',
    '--exclude-entrypoints',
    'hudsonkit/styles',
    'hudsonkit/styles/tokens.css',
  ]);
} catch (error) {
  process.stderr.write(`[hudsonkit] package validation failed: ${error.message}\n`);
  process.exitCode = error.exitCode ?? 1;
} finally {
  rmSync(artifactDir, { recursive: true, force: true });
}
