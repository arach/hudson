import { resolve, join, dirname, basename } from 'path';
import { readdir, readFile, mkdir, writeFile, stat } from 'fs/promises';
import type { TemplateVars, Tier } from './utils';
import { transform, transformFilename } from './transform';
import { fileCreated } from './log';

// ---------------------------------------------------------------------------
// Template directory resolution
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = resolve(import.meta.dirname, '..', 'templates');

// ---------------------------------------------------------------------------
// File list builder
// ---------------------------------------------------------------------------

interface TemplateFile {
  /** Absolute source path */
  src: string;
  /** Relative dest path under app/apps/<id>/ (after transform) */
  dest: string;
}

async function collectFiles(dir: string, vars: TemplateVars, prefix = ''): Promise<TemplateFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: TemplateFile[] = [];

  for (const entry of entries) {
    const srcPath = join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await collectFiles(srcPath, vars, relPath);
      files.push(...subFiles);
    } else {
      const destName = transformFilename(relPath, vars);
      files.push({ src: srcPath, dest: destName });
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Scaffold orchestrator
// ---------------------------------------------------------------------------

export interface ScaffoldOptions {
  appId: string;
  tier: Tier;
  vars: TemplateVars;
  /** Project root (where app/ lives) */
  projectRoot: string;
}

export async function scaffold(opts: ScaffoldOptions): Promise<string[]> {
  const { appId, tier, vars, projectRoot } = opts;
  const appDir = resolve(projectRoot, 'app', 'apps', appId);

  // Collect template files: shared + tier-specific
  const sharedDir = join(TEMPLATES_DIR, 'shared');
  const tierDir = join(TEMPLATES_DIR, tier);

  const sharedFiles = await collectFiles(sharedDir, vars);
  const tierFiles = await collectFiles(tierDir, vars);

  const allFiles = [...tierFiles, ...sharedFiles];

  // De-duplicate by dest (tier files win over shared)
  const seen = new Set<string>();
  const uniqueFiles: TemplateFile[] = [];
  for (const f of allFiles) {
    if (!seen.has(f.dest)) {
      seen.add(f.dest);
      uniqueFiles.push(f);
    }
  }

  // Write files
  const createdPaths: string[] = [];

  for (const file of uniqueFiles) {
    const destPath = join(appDir, file.dest);
    const destDir = dirname(destPath);

    await mkdir(destDir, { recursive: true });

    const raw = await readFile(file.src, 'utf-8');
    const content = transform(raw, vars);

    await writeFile(destPath, content, 'utf-8');

    const relPath = `app/apps/${appId}/${file.dest}`;
    fileCreated(relPath);
    createdPaths.push(relPath);
  }

  return createdPaths;
}
