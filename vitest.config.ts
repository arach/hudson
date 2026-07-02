import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = __dirname;
const rootNodeModules = resolve(root, 'node_modules');
const hudsonkitSrc = resolve(root, 'node_modules/hudsonkit/src');

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      '.claude/**',
      '.build/**',
      // Worker tests run with their own vitest config (node env, own deps) in
      // CI's "Worker tests" step — don't double-run them under jsdom here.
      'packages/cloud/**',
      '**/.build/**',
      'examples/**/.build/**',
      'packages/native/**/.build/**',
    ],
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@', replacement: root },
      { find: 'react/jsx-dev-runtime', replacement: resolve(rootNodeModules, 'react/jsx-dev-runtime.js') },
      { find: 'react/jsx-runtime', replacement: resolve(rootNodeModules, 'react/jsx-runtime.js') },
      { find: 'react-dom/client', replacement: resolve(rootNodeModules, 'react-dom/client.js') },
      { find: 'react-dom', replacement: resolve(rootNodeModules, 'react-dom') },
      { find: 'react', replacement: resolve(rootNodeModules, 'react') },
      { find: 'ai', replacement: resolve(rootNodeModules, 'ai') },
      { find: '@ai-sdk/react', replacement: resolve(rootNodeModules, '@ai-sdk/react') },
      { find: 'lucide-react', replacement: resolve(rootNodeModules, 'lucide-react') },
      { find: 'server-only', replacement: resolve(root, 'test/mocks/server-only.ts') },
      {
        find: 'hudsonkit/workflow',
        replacement: resolve(hudsonkitSrc, 'workflow/index.ts'),
      },
      {
        find: 'hudsonkit/apps',
        replacement: resolve(hudsonkitSrc, 'apps/index.ts'),
      },
      {
        find: /^hudsonkit\/(.+)$/,
        replacement: `${hudsonkitSrc}/$1.ts`,
      },
      { find: 'hudsonkit', replacement: resolve(hudsonkitSrc, 'index.ts') },
      {
        find: '@hudsonkit/ai/toolsets',
        replacement: resolve(root, 'packages/web/ai-backends/src/toolsets/index.ts'),
      },
      {
        find: '@hudsonkit/ai',
        replacement: resolve(root, 'packages/web/ai-backends/src/index.ts'),
      },
    ],
  },
});
