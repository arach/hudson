import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'hudsonkit/shell': resolve(__dirname, 'packages/web/hudsonkit/src/shell.ts'),
      'hudsonkit': resolve(__dirname, 'packages/web/hudsonkit/src/index.ts'),
    },
  },
});
