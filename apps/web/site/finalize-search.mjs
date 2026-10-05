import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, canonicalUrl, docPath, isIndexableDoc, sitemapXml, assertIndexableHtml } from './seo.ts';

// These are real static public pages. Editor sessions, client redirects, and SPA fallbacks are omitted.
export const ARC_SEARCH_PATHS = [
  '/arc/',
  '/arc/architecture-diagram-software/',
  '/arc/mcp/',
  '/arc/skills/',
  '/arc/docs/',
  '/arc/docs/agents/',
  '/arc/docs/agent-mcp/',
  '/arc/docs/skills/',
];

export function withCanonical(html, url) {
  const tag = `<link rel="canonical" href="${url}">`;
  const withoutOld = html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '');
  if (!/<\/head>/i.test(withoutOld)) throw new Error(`Missing HTML head for ${url}`);
  return withoutOld.replace(/<\/head>/i, `${tag}</head>`);
}

export async function writeSearchFiles(outDir) {
  const routes = [{ path: '/', file: 'landing/index.html' }, { path: '/license/', file: 'license/index.html' }];
  const docsDir = join(outDir, 'docs');
  async function walkDocs(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walkDocs(file);
      else if (entry.name === 'index.html' && dir !== docsDir) {
        const slug = relative(docsDir, dir).split('\\').join('/');
        if (isIndexableDoc(slug)) routes.push({ path: docPath(slug), file: `docs/${slug}/index.html` });
      }
    }
  }
  await walkDocs(docsDir);
  const arcUrls = [];
  if (existsSync(join(outDir, 'arc', 'index.html'))) {
    for (const path of ARC_SEARCH_PATHS) {
      const file = `${path.slice(1)}index.html`;
      const url = canonicalUrl(path);
      const html = withCanonical(await readFile(join(outDir, file), 'utf-8'), url);
      await writeFile(join(outDir, file), html);
      routes.push({ path, file });
      arcUrls.push(url);
    }
    await writeFile(join(outDir, 'arc', 'sitemap.xml'), sitemapXml(arcUrls));
    await writeFile(join(outDir, 'arc', 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/arc/sitemap.xml\n`);
  }
  const urls = [];
  for (const route of routes) {
    const url = canonicalUrl(route.path);
    // An absent, redirected, noindex, or noncanonical page must fail the build instead of entering the sitemap.
    assertIndexableHtml(await readFile(join(outDir, route.file), 'utf-8'), url);
    urls.push(url);
  }
  await writeFile(join(outDir, 'sitemap.xml'), sitemapXml(urls.sort()));
  await writeFile(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  console.log(`Validated ${urls.length} canonical indexable sitemap pages (${arcUrls.length} ARC pages)`);
}

if (import.meta.main) await writeSearchFiles(join(dirname(fileURLToPath(import.meta.url)), 'out'));
