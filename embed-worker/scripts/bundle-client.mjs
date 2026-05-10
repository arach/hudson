#!/usr/bin/env node
/**
 * bundle-client.mjs
 *
 * Bundles app/embed/client.tsx into a single self-contained JS file using
 * esbuild. Output lands at public/embed/client.js and is served by Pages CDN.
 *
 * The Worker's HTML shell references this as:
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

const sdkSrc = join(root, 'packages/web/hudsonkit/src');

// Resolve `hudsonkit` and `hudsonkit/<sub>` against the SDK source tree (top-
// level barrel files like src/shell.ts, src/controls.ts). The package's
// exports map points at dist/, but the embed client bundle is built from
// source so local SDK edits flow through without a separate SDK build step.
const hudsonkitResolverPlugin = {
  name: 'hudsonkit-src-resolver',
  setup(build) {
    build.onResolve({ filter: /^hudsonkit($|\/)/ }, (args) => {
      if (args.path === 'hudsonkit') {
        return { path: join(sdkSrc, 'index.ts') };
      }
      const sub = args.path.slice('hudsonkit/'.length);
      return { path: join(sdkSrc, `${sub}.ts`) };
    });
  },
};

// Replace the dev-only registry sidecar with a no-op stub. The runtime call
// site in app/apps/registry.ts gates the require() on NODE_ENV ===
// 'development', but esbuild can't always prune through CommonJS require, so
// we explicitly stub it. Without this, the bundler walks into whatever the
// developer has on disk at app/local/apps.local.ts (which often imports
// sibling projects like ~/dev/arc) and fails to resolve.
const stubAppsLocalPlugin = {
  name: 'stub-apps-local',
  setup(build) {
    build.onResolve({ filter: /(^|\/)local\/apps\.local$/ }, (args) => ({
      path: args.path,
      namespace: 'stub-apps-local',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-apps-local' }, () => ({
      contents: 'module.exports = { localApps: [], localWorkspaces: [] };',
      loader: 'js',
    }));
  },
};

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
  // Force NODE_ENV so dev-only branches in app code dead-code-eliminate.
  define: { 'process.env.NODE_ENV': '"production"' },
  // Some transitive deps reference `process.env.SOMETHING` or just `process`
  // outside of guarded checks. In a browser there's no `process` global, so
  // the bundle throws `ReferenceError: process is not defined` before React
  // can mount. Inject a minimal shim at the top of the bundle so any such
  // access falls through to undefined harmlessly.
  banner: {
    js: "if(typeof globalThis.process==='undefined')globalThis.process={env:{}};",
  },
  plugins: [hudsonkitResolverPlugin, stubAppsLocalPlugin],
  // Tree-shake aggressively
  treeShaking: true,
  logLevel: 'info',
});

console.log(`[bundle-client] Done → ${outFile}`);
