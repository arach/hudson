import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'pi-ai': 'src/pi-ai.ts',
    'vercel-ai': 'src/adapters/vercel-ai.ts',
    scout: 'src/scout.ts',
    toolsets: 'src/toolsets/index.ts',
    conversation: 'src/conversation/index.ts',
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
    '@openscout/agent-sessions',
    /^@openscout\/agent-sessions\//,
  ],
});
