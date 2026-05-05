import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextAppDir = join(root, '.next', 'server', 'app');
const docsSourceDir = join(root, 'docs');
const primaryOut = join(root, 'site', 'out');
const cloudflareConfiguredOut = join(root, 'site', 'site', 'out');

const staticRoutes = [
  'index',
  'preview',
  'app',
  'demo',
  'docs',
  'theme-preview',
];

async function copyIfExists(from, to) {
  if (!existsSync(from)) return false;
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, {
    recursive: true,
    filter: (source) => !source.split('/').some(part => part === '.DS_Store'),
  });
  return true;
}

async function copyRoute(route, outDir) {
  const source = join(nextAppDir, `${route}.html`);
  if (!existsSync(source)) return;

  const target = route === 'index'
    ? join(outDir, 'index.html')
    : join(outDir, route, 'index.html');
  await copyIfExists(source, target);
}

async function copyDocs(outDir) {
  const docsDir = join(nextAppDir, 'docs');
  if (!existsSync(docsDir)) return;

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const rel = relative(docsDir, abs).replace(/\.html$/, '');
      await copyIfExists(abs, join(outDir, 'docs', rel, 'index.html'));
    }
  }

  await walk(docsDir);
}

async function collectDocs() {
  const results = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (entry.name === 'agent' || entry.name === 'prompts' || entry.name === 'coordination') continue;
        await walk(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        continue;
      }
      if (!entry.name.endsWith('.md') || entry.name === 'index.md') continue;
      const slug = (prefix ? `${prefix}/` : '') + entry.name.replace(/\.md$/, '');
      const raw = await readFile(join(dir, entry.name), 'utf-8');
      const { data, content } = matter(raw);
      results.push({
        slug,
        title: data.title ?? slug,
        description: data.description ?? '',
        content,
      });
    }
  }
  await walk(docsSourceDir);
  results.sort((a, b) => a.slug.localeCompare(b.slug));
  return results;
}

async function writeLLMsFiles(outDir) {
  if (!existsSync(docsSourceDir)) return;
  const docs = await collectDocs();

  const indexLines = [
    '# hudson',
    '> Multi-app canvas workspace platform for React, iOS, and macOS',
    '',
    '## Documentation',
    ...docs.map((d) => `- [${d.title}](https://hudsonkit.com/docs/${d.slug}): ${d.description}`),
    '',
    '## Full documentation',
    'https://hudsonkit.com/llms-full.txt',
    '',
  ];
  await writeFile(join(outDir, 'llms.txt'), indexLines.join('\n'));

  const fullLines = [
    '# hudson — full documentation',
    '',
  ];
  for (const d of docs) {
    fullLines.push(`# ${d.title}`, '', `> Source: https://hudsonkit.com/docs/${d.slug}`, '');
    if (d.description) fullLines.push(d.description, '');
    fullLines.push(d.content.trim(), '', '---', '');
  }
  await writeFile(join(outDir, 'llms-full.txt'), fullLines.join('\n'));
}

async function exportTo(outDir) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const route of staticRoutes) {
    await copyRoute(route, outDir);
  }
  await copyDocs(outDir);
  await writeLLMsFiles(outDir);

  await copyIfExists(join(root, '.next', 'static'), join(outDir, '_next', 'static'));
  await copyIfExists(join(root, 'public'), outDir);

  await writeFile(
    join(outDir, '_headers'),
    [
      '/_next/static/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
      '/*',
      '  X-Frame-Options: SAMEORIGIN',
      '',
    ].join('\n'),
  );
}

await exportTo(primaryOut);
await exportTo(cloudflareConfiguredOut);

console.log(`Exported HudsonKit Pages site to ${primaryOut}`);
console.log(`Exported HudsonKit Pages site to ${cloudflareConfiguredOut}`);
