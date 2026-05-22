import { defineConfig } from 'tsup';

const sharedExternal = [
  'react',
  'react-dom',
  'lucide-react',
  // Optional peer deps — dynamic imports only
  '@xterm/xterm',
  '@xterm/addon-fit',
  '@xterm/addon-webgl',
  '@voxd/client',
  'html2canvas-pro',
];

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      shell: 'src/shell.ts',
      'app-shell': 'src/app-shell.ts',
      chrome: 'src/chrome.ts',
      overlays: 'src/overlays.ts',
      'context-menu': 'src/context-menu.ts',
      canvas: 'src/canvas.ts',
      windows: 'src/windows.ts',
      theme: 'src/theme.ts',
      controls: 'src/controls.ts',
      cache: 'src/cache.ts',
      workflow: 'src/workflow/index.ts',
      observability: 'src/observability.ts',
      voice: 'src/voice.ts',
      vault: 'src/vault.ts',
      auth: 'src/auth.ts',
      push: 'src/push.ts',
      'push/sw': 'src/push/sw.ts',
      table: 'src/table.ts',
      player: 'src/player.ts',
      primitives: 'src/primitives.ts',
      patterns: 'src/patterns.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: true,
    treeshake: true,
    clean: true,
    outDir: 'dist',
    external: sharedExternal,
    banner: {
      js: "'use client';",
    },
  },
  {
    // Server-safe entry: no 'use client' banner, no shared chunks with the
    // client bundle, so it can be imported from React Server Components.
    entry: {
      'theme-script': 'src/theme-script.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: false,
    treeshake: true,
    clean: false,
    outDir: 'dist',
    external: sharedExternal,
  },
]);

// Note: the Node-only `hudsonkit/server` entry (HUD-008) is built by a separate
// tsup invocation against `tsup.server.config.ts`. Running it together with the
// client-bannered configs causes tsup's DTS bundler to clobber outputs across
// configs, so the server build is sequenced after the main build via the
// `build:js` script.
