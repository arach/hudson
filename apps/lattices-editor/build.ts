import { mkdir, copyFile } from 'node:fs/promises';
const root = import.meta.dir;
const dev = process.argv.includes('--dev');
const outdir = `${root}/${dev ? 'dist-dev' : 'dist'}`;
await mkdir(outdir, { recursive: true });
const result = await Bun.build({ entrypoints: [`${root}/main.tsx`], outdir, naming: 'editor.[ext]', target: 'browser', format: 'iife', minify: true, define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') } });
if (!result.success) { console.error(result.logs); process.exit(1); }
await copyFile(`${root}/../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`, `${outdir}/jetbrains-mono-latin-400-normal.woff2`);
await copyFile(`${root}/../../node_modules/@fontsource/jetbrains-mono/LICENSE`, `${outdir}/jetbrains-mono-LICENSE.txt`);
const css = Bun.spawn([process.execPath, 'x', '--no-install', '@tailwindcss/cli', '-i', `${root}/styles.css`, '-o', `${outdir}/editor.css`, '--minify'], { stdout: 'inherit', stderr: 'inherit' });
if (await css.exited) process.exit(1);
await copyFile(`${root}/index.html`, `${outdir}/index.html`);
console.log(`Built static Editor: ${outdir}`);
