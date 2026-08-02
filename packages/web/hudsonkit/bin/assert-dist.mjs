#!/usr/bin/env node
// Fail-fast gate for sealed hudsonkit artifacts.
// Packed / prepared packages must carry dist/styles.css (and the tokens +
// type-decl companions). Without styles.css, consumers that
// `import 'hudsonkit/styles'` fail at install/build time — iris clean
// reinstall is the acceptance path for this gate.

import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(pkgRoot, 'dist');

/** @type {{ path: string; minBytes?: number }[]} */
const required = [
  { path: join(dist, 'index.js'), minBytes: 1 },
  // The consumer-visible CSS surface. Missing this is the classic pack bug.
  { path: join(dist, 'styles.css'), minBytes: 1024 },
  { path: join(dist, 'styles.d.ts'), minBytes: 1 },
  { path: join(dist, 'tokens.css'), minBytes: 1 },
  { path: join(dist, 'styles-tokens.d.ts'), minBytes: 1 },
];

const missing = [];
for (const { path, minBytes = 1 } of required) {
  if (!existsSync(path)) {
    missing.push(`${path} (missing)`);
    continue;
  }
  const size = statSync(path).size;
  if (size < minBytes) {
    missing.push(`${path} (too small: ${size}B < ${minBytes}B)`);
  }
}

if (missing.length > 0) {
  process.stderr.write(
    '[hudsonkit] assert-dist: required dist artifacts incomplete:\n' +
      missing.map((m) => `  - ${m}`).join('\n') +
      '\n\nRun `bun run build` (js + css) inside packages/web/hudsonkit before pack/publish.\n',
  );
  process.exit(1);
}

process.stdout.write('[hudsonkit] assert-dist: ok (styles.css + companions present)\n');
