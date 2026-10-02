import { defineConfig } from 'tsup';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sharedExternal = [
  'react',
  'react-dom',
  'iconoir-react',
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
  workspace: 'src/workspace.ts',
  chrome: 'src/chrome.ts',
  overlays: 'src/overlays.ts',
  'context-menu': 'src/context-menu.ts',
  behaviors: 'src/behaviors.ts',
  canvas: 'src/canvas.ts',
  windows: 'src/windows.ts',
  theme: 'src/theme.ts',
  terminal: 'src/terminal.ts',
  controls: 'src/controls.ts',
  icons: 'src/icons.tsx',
  flags: 'src/flags.ts',
  cache: 'src/cache.ts',
  workflow: 'src/workflow/index.ts',
  'agent-composer': 'src/agent-composer.ts',
  'agent-workspace': 'src/agent-workspace.ts',
  'editor-workspace': 'src/editor-workspace.ts',
  'editor-panels': 'src/editor-panels.tsx',
  'code-surface': 'src/editor/code-surface.ts',
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
  nav: 'src/nav.ts',
  apps: 'src/apps/index.ts',
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

// dist/styles.css + tokens are produced by `build:css` (Tailwind), not tsup.
// tsup's default `clean: true` rimrafs the whole outDir and drops those files,
// so a JS-only rebuild leaves consumers (esp. pnpm file: installs that snapshot
// dist/) without `hudsonkit/styles`. Preserve the CSS pipeline outputs across
// JS cleans.
const PRESERVE_DIST = new Set([
  'styles.css',
  'tokens.css',
  'styles.d.ts',
  'styles-tokens.d.ts',
  'agent-composer.css',
  'agent-composer-styles.d.ts',
  'agent-workspace.css',
  'agent-workspace-styles.d.ts',
]);

let cleanedDist = false;

async function cleanDistPreserveCss() {
  if (cleanedDist) return;
  cleanedDist = true;
  const distDir = 'dist';
  let entries: string[];
  try {
    entries = await readdir(distDir);
  } catch {
    return;
  }
  await Promise.all(
    entries.map(async (name) => {
      if (PRESERVE_DIST.has(name)) return;
      await rm(join(distDir, name), { recursive: true, force: true });
    }),
  );
}

export default defineConfig({
  entry: clientEntries,
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  // Custom clean — see cleanDistPreserveCss above.
  clean: false,
  outDir: 'dist',
  external: sharedExternal,
  plugins: [
    {
      name: 'clean-dist-preserve-css',
      async buildStart() {
        await cleanDistPreserveCss();
      },
    },
  ],
  onSuccess: markClientEntries,
});

// Note: server-safe entries (`hudsonkit/theme-script`, `hudsonkit/server`) are
// built by separate tsup invocations. Running them together with the
// client entry config causes tsup's DTS bundler to clobber outputs across
// configs, so they are sequenced after the main build via the `build:js` script.
