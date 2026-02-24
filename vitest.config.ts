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
      '@hudson/sdk/shell': resolve(__dirname, 'packages/hudson-sdk/src/shell.ts'),
      '@hudson/sdk': resolve(__dirname, 'packages/hudson-sdk/src/index.ts'),
    },
  },
});
