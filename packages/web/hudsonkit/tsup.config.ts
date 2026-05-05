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
      observability: 'src/observability.ts',
      voice: 'src/voice.ts',
      vault: 'src/vault.ts',
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
