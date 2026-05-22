import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'vercel-ai': 'src/adapters/vercel-ai.ts',
    toolsets: 'src/toolsets/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  external: [
    '@earendil-works/pi-ai',
    'ai',
  ],
});
