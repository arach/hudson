import { defineConfig } from 'tsup';

// Server-safe theme bootstrap entry. Built after the client bundle so tsup's
// DTS writer cannot race or remove `dist/theme-script.d.ts`.
export default defineConfig({
  entry: {
    'theme-script': 'src/theme-script.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  treeshake: true,
  clean: false,
  outDir: 'dist',
  external: [
    'react',
    'react-dom',
    'iconoir-react',
  ],
});
