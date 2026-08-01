import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'path';
import rootConfig from '../../../apps/web/vitest.config';

// Package-scoped test run: reuse the web app's repo-anchored config (jsdom, setup
// file, react/hudsonkit aliases) but only pick up this package's __tests__.
const repoRoot = resolve(__dirname, '../../..');

export default mergeConfig(
  rootConfig,
  defineConfig({
    root: repoRoot,
    test: {
      include: ['packages/web/hudsonkit/__tests__/**/*.test.{ts,tsx}'],
    },
  }),
);
