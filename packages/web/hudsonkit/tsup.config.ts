import { defineConfig } from 'tsup';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sharedExternal = [
  'react',
  'react-dom',
  'lucide-react',
  // Optional peer deps — keep external so narrow subpaths/dynamic imports do
  // not inline heavy optional features into core chunks.
  '@codemirror/commands',
  '@codemirror/lang-css',
  '@codemirror/lang-html',
  '@codemirror/lang-javascript',
  '@codemirror/lang-json',
  '@codemirror/lang-markdown',
  '@codemirror/language',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/highlight',
  '@pierre/diffs',
  '@pierre/diffs/react',
  'codemirror',
  'react-markdown',
  'remark-gfm',
  '@xterm/xterm',
  '@xterm/addon-fit',
  '@xterm/addon-webgl',
  '@voxd/client',
  'html2canvas-pro',
];

const clientEntries = {
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
};

async function markClientEntries() {
  await Promise.all(Object.keys(clientEntries).map(async entryName => {
    const file = join('dist', `${entryName}.js`);
    const contents = await readFile(file, 'utf8').catch(() => null);
    if (!contents) return;
    if (contents.startsWith("'use client';") || contents.startsWith('"use client";')) return;
    await writeFile(file, `'use client';\n${contents}`);
  }));
}

export default defineConfig([
  {
    entry: clientEntries,
    format: ['esm'],
    dts: true,
    splitting: true,
    treeshake: true,
    clean: true,
    outDir: 'dist',
    external: sharedExternal,
    onSuccess: markClientEntries,
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
// client entry config causes tsup's DTS bundler to clobber outputs across
// configs, so the server build is sequenced after the main build via the
// `build:js` script.
