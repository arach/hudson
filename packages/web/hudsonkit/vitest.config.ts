import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { resolve } from 'path';

// Package-scoped, self-contained vitest config.
// It deliberately does not import the web app config: package test behavior
// should not change when the application suite moves or changes its aliases.
const pkgRoot = __dirname;
const repoRoot = resolve(pkgRoot, '../../..');

// Prefer the monorepo-hoisted React (and peers). Package-local bun links can
// point at sibling checkouts (e.g. studio) and dual-React breaks hooks.
function resolveFromRoots(...segments: string[]): string {
  const candidates = [
    resolve(pkgRoot, 'node_modules', ...segments),
    resolve(repoRoot, 'node_modules', ...segments),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fall through to the repo-root path for a clear resolve error if missing.
  return candidates[1] ?? candidates[0];
}

// Prefer monorepo-root packages when present. Package-local bun links in this
// workspace can point at sibling checkouts (studio) and introduce dual-React
// (or dual-ai-sdk) copies that break hooks under vitest.
function pin(name: string, ...segments: string[]): string {
  const rootPath = resolve(repoRoot, 'node_modules', name, ...segments);
  if (existsSync(rootPath)) return rootPath;
  return resolveFromRoots(name, ...segments);
}

const reactRoot = pin('react');
const reactDomRoot = pin('react-dom');

export default defineConfig({
  root: pkgRoot,
  test: {
    environment: 'jsdom',
    setupFiles: [resolve(pkgRoot, '__tests__/setup.ts')],
    globals: true,
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    preserveSymlinks: false,
    dedupe: ['react', 'react-dom', 'ai', '@ai-sdk/react'],
    // Package tests import via relative `../src/...` paths; keep a hudsonkit
    // alias for any tests that resolve the public package name. Pin React +
    // AI SDK so package-local bun links cannot introduce a second copy.
    alias: [
      { find: 'react/jsx-dev-runtime', replacement: resolve(reactRoot, 'jsx-dev-runtime.js') },
      { find: 'react/jsx-runtime', replacement: resolve(reactRoot, 'jsx-runtime.js') },
      { find: 'react-dom/client', replacement: resolve(reactDomRoot, 'client.js') },
      { find: 'react-dom', replacement: reactDomRoot },
      { find: 'react', replacement: reactRoot },
      { find: '@ai-sdk/react', replacement: pin('@ai-sdk/react') },
      { find: 'ai', replacement: pin('ai') },
      { find: 'motion', replacement: pin('motion') },
      {
        find: 'hudsonkit/workflow',
        replacement: resolve(pkgRoot, 'src/workflow/index.ts'),
      },
      {
        find: 'hudsonkit/apps',
        replacement: resolve(pkgRoot, 'src/apps/index.ts'),
      },
      {
        find: /^hudsonkit\/(.+)$/,
        replacement: `${resolve(pkgRoot, 'src')}/$1.ts`,
      },
      { find: 'hudsonkit', replacement: resolve(pkgRoot, 'src/index.ts') },
    ],
  },
});
