import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { getAllSlugs } from './docs';
import { REPO_ROOT } from './repoRoot';
import { REPOSITORY_URL, docPath } from '../../site/seo';

let publishedSlugs: Set<string> | undefined;

/** Resolve Markdown links relative to their source file, not the public page directory. */
export function rewriteDocLink(url: string, slug: string): string {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return url;
  const [, file, suffix = ''] = url.match(/^([^?#]+)([?#].*)?$/) ?? [];
  if (!file) return url;
  const target = path.resolve(REPO_ROOT, 'docs', path.dirname(slug), file);
  const repoPath = path.relative(REPO_ROOT, target).split(path.sep).join('/');
  // Only link to source we can verify. A missing target remains visible to link audits.
  if (repoPath.startsWith('../') || !existsSync(target)) return url;
  publishedSlugs ??= new Set(getAllSlugs());
  if (repoPath.startsWith('docs/') && repoPath.endsWith('.md')) {
    const docSlug = repoPath.slice('docs/'.length, -'.md'.length);
    if (publishedSlugs.has(docSlug)) return `${docPath(docSlug)}${suffix}`;
  }
  const kind = statSync(target).isDirectory() ? 'tree' : 'blob';
  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  return `${REPOSITORY_URL}/${kind}/main/${encodedPath}${suffix}`;
}

const remarkRewriteLinks: Plugin<[{ slug: string }], Root> = ({ slug }) => tree => {
  visit(tree, ['link', 'definition'], node => {
    if (node.type === 'link' || node.type === 'definition') node.url = rewriteDocLink(node.url, slug);
  });
};

export default remarkRewriteLinks;
