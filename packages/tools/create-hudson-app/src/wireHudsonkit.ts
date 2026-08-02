import { resolve, dirname, join } from 'path';
import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { info, cyan, dim, yellow } from './log';

/**
 * Resolve a hudsonkit tarball for pre-publish greening.
 *
 * Priority:
 * 1. HUDSONKIT_TGZ env (absolute or relative path)
 * 2. Monorepo pack matching packages/web/hudsonkit package.json version
 *    (walks up from cwd looking for packages/web/hudsonkit/)
 *
 * Uses the *exact* versioned filename — not lexicographically-last glob —
 * so a stale higher-version leftover cannot win.
 */
export async function resolveHudsonkitTgz(fromDir: string = process.cwd()): Promise<string | null> {
  const envPath = process.env.HUDSONKIT_TGZ?.trim();
  if (envPath) {
    const abs = resolve(fromDir, envPath);
    try {
      await stat(abs);
      return abs;
    } catch {
      throw new Error(`HUDSONKIT_TGZ not found: ${abs}`);
    }
  }

  let current = fromDir;
  while (current !== '/') {
    const kitPkg = join(current, 'packages', 'web', 'hudsonkit', 'package.json');
    if (existsSync(kitPkg)) {
      const raw = await readFile(kitPkg, 'utf-8');
      const version = (JSON.parse(raw) as { version?: string }).version;
      if (!version) return null;
      const tgz = join(current, 'packages', 'web', 'hudsonkit', `hudsonkit-${version}.tgz`);
      if (existsSync(tgz)) return tgz;
      // Monorepo found but no pack yet — tell caller so next-steps can mention pack.
      return null;
    }
    current = dirname(current);
  }
  return null;
}

/** Rewrite scaffolded package.json hudsonkit dep to file: when a local pack exists. */
export async function wireStandaloneHudsonkit(appDir: string, fromDir?: string): Promise<string | null> {
  const tgz = await resolveHudsonkitTgz(fromDir ?? process.cwd());
  if (!tgz) return null;

  const pkgPath = join(appDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
  };
  if (!pkg.dependencies) pkg.dependencies = {};
  pkg.dependencies.hudsonkit = `file:${tgz}`;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');

  info(`Wired ${cyan('hudsonkit')} → ${dim(`file:${tgz}`)}`);
  info(dim('(local validation pack; restore ^0.4.0 to use the published dependency)'));
  return tgz;
}

export function warnMissingMonorepoPack(fromDir: string = process.cwd()): void {
  let current = fromDir;
  while (current !== '/') {
    const kitDir = join(current, 'packages', 'web', 'hudsonkit');
    if (existsSync(join(kitDir, 'package.json'))) {
      info(
        `${yellow('Note:')} No hudsonkit-*.tgz at ${kitDir} — run: ${cyan('cd packages/web/hudsonkit && bun run pack')}`,
      );
      return;
    }
    current = dirname(current);
  }
}
