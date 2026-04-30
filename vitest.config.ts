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
      'hudsonkit/shell': resolve(__dirname, 'packages/hudson-sdk/src/shell.ts'),
      'hudsonkit': resolve(__dirname, 'packages/hudson-sdk/src/index.ts'),
    },
  },
});
