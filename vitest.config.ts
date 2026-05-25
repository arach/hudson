import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      '.claude/**',
      '.build/**',
      'examples/**/.build/**',
      'packages/native/**/.build/**',
    ],
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, '.') },
      {
        find: 'hudsonkit/workflow',
        replacement: resolve(__dirname, 'packages/web/hudsonkit/src/workflow/index.ts'),
      },
      {
        find: /^hudsonkit\/(.+)$/,
        replacement: `${resolve(__dirname, 'packages/web/hudsonkit/src')}/$1.ts`,
      },
      { find: 'hudsonkit', replacement: resolve(__dirname, 'packages/web/hudsonkit/src/index.ts') },
      {
        find: '@hudsonkit/ai/toolsets',
        replacement: resolve(__dirname, 'packages/web/ai-backends/src/toolsets/index.ts'),
      },
      {
        find: '@hudsonkit/ai',
        replacement: resolve(__dirname, 'packages/web/ai-backends/src/index.ts'),
      },
    ],
  },
});
