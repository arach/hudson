import { defineConfig } from 'tsup';

// hudsonkit/server (HUD-008): server-only helpers. Built in a separate tsup
// pass so the DTS bundler does not race the client-bannered config and clobber
// `dist/server.d.ts`.

export default defineConfig({
  entry: {
    server: 'src/server.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  treeshake: true,
  clean: false,
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
  external: [
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:os',
    // Must remain an external import — the build-time guard relies on the
    // consumer's bundler resolving `server-only` against its client/server
    // condition, not on tsup inlining the no-op server stub.
    'server-only',
  ],
});
