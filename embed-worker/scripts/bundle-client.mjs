#!/usr/bin/env node
/**
 * bundle-client.mjs
 *
 * Bundles app/embed/client.tsx into a single self-contained JS file using
 * esbuild. Output lands at public/embed/client.js and is served by Pages CDN.
 *
 * The Worker's fallback HTML shell references this as:
 *   <script src="/embed/client.js" type="module"></script>
 *
 * Usage (from repo root):
 *   node embed-worker/scripts/bundle-client.mjs
 * Or:
 *   bun run embed:bundle
 */

import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..', '..');
const entry = join(root, 'app', 'embed', 'client.tsx');
const outDir = join(root, 'public', 'embed');
const outFile = join(outDir, 'client.js');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

console.log('[bundle-client] Bundling embed client entry...');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  outfile: outFile,
  // Minify for production
  minify: process.env.NODE_ENV !== 'development',
  // Source maps for debugging
  sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  // Target modern browsers (embed use-case; no IE support needed)
  target: ['chrome100', 'firefox100', 'safari16'],
  // JSX transform — React 19 automatic runtime
  jsx: 'automatic',
  // Mark Node built-ins as external (shouldn't be any in the embed client)
  platform: 'browser',
  // Resolve monorepo alias for hudsonkit
  alias: {
    'hudsonkit': join(root, 'packages/web/hudsonkit/src/index.ts'),
    'hudsonkit/shell': join(root, 'packages/web/hudsonkit/src/shell/index.ts'),
  },
  // Tree-shake aggressively
  treeShaking: true,
  logLevel: 'info',
});

console.log(`[bundle-client] Done → ${outFile}`);
