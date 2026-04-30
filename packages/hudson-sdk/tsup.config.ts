import { defineConfig } from 'tsup';

export default defineConfig({
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
    voice: 'src/voice.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  external: [
    'react',
    'react-dom',
    'lucide-react',
    // Optional peer deps — dynamic imports only
    '@xterm/xterm',
    '@xterm/addon-fit',
    '@xterm/addon-webgl',
    '@voxd/client',
    'html2canvas-pro',
  ],
  banner: {
    js: "'use client';",
  },
});
