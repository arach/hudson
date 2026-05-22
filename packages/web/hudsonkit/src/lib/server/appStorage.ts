// ---------------------------------------------------------------------------
// appStorage (HUD-008) — server-only.
//
// Provides the `~/hudson/{storageId}/.data` + `{project}/.data/{storageId}`
// pattern with seed-if-empty bookkeeping. Lives under `hudsonkit/server`; do
// not import from this module from any client-bannered entrypoint.
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';

export interface AppStoragePaths {
  user: string;
  seed: string;
}

export interface AppStorageSeedOptions {
  /** Subdirectory inside userDir/seedDir. Defaults to `.`. */
  rel?: string;
  /** Filename predicate. Defaults to all directory entries. */
  match?: (name: string) => boolean;
  /** Copy bundled seed files that are missing from the user dir before empty check. */
  copyMissing?: boolean;
  /** Called if the user dir still has no matching files after seed copy. */
  fallback?: (ctx: { userDir: string; seedDir: string }) => Promise<void> | void;
}

export interface AppStorage {
  readonly appId: string;
  readonly storageId: string;
  readonly userDir: string;
  readonly seedDir: string;

  /** Ensure the user directory, or a child path, exists. Returns the absolute path. */
  ensure(rel?: string): Promise<string>;

  /** Resolve a path under both user and seed roots. Rejects traversal outside the roots. */
  paths(rel?: string): AppStoragePaths;

  /** Seed user storage from bundled data and/or fallback generation. */
  seedIfEmpty(options?: AppStorageSeedOptions): Promise<void>;
}

export interface AppStorageOptions {
  /** Namespace override relative to `~/hudson/` and `{project}/.data/`. Defaults to appId. */
  dataDir?: string;
  /**
   * Legacy namespace to migrate from on first `ensure()` call. Renames
   * `~/hudson/{migrateFromDataDir}/.data` to the current `userDir` if and only
   * if the new dir does not already exist. Idempotent and safe to leave in
   * place after the migration.
   */
  migrateFromDataDir?: string;
  /** Defaults to `process.env.HOME`. */
  homeDir?: string;
  /** Defaults to `process.cwd()`. */
  projectDir?: string;
}

function validateNamespace(name: string, label: string): void {
  if (!name) {
    throw new Error(`hudsonkit/server: appStorage ${label} cannot be empty`);
  }
  if (name.includes('/') || name.includes('\\') || name.includes(sep)) {
    throw new Error(`hudsonkit/server: appStorage ${label} must be a single segment: "${name}"`);
  }
  if (name === '.' || name === '..' || name.startsWith('..')) {
    throw new Error(`hudsonkit/server: appStorage ${label} must not be relative: "${name}"`);
  }
  if (isAbsolute(name)) {
    throw new Error(`hudsonkit/server: appStorage ${label} must not be absolute: "${name}"`);
  }
}

function resolveWithin(root: string, rel: string | undefined, label: string): string {
  if (!rel) return root;
  if (isAbsolute(rel)) {
    throw new Error(`hudsonkit/server: appStorage path "${rel}" must be relative to ${label}`);
  }
  const target = normalize(join(root, rel));
  const within = relative(root, target);
  if (within.startsWith('..') || isAbsolute(within)) {
    throw new Error(`hudsonkit/server: appStorage path "${rel}" escapes ${label}`);
  }
  return target;
}

async function listMatchingFiles(
  dir: string,
  match: (name: string) => boolean,
): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter(match);
}

/**
 * Idempotent rename from legacy `~/hudson/{legacy}/.data` to the new
 * `~/hudson/{storageId}/.data` directory.
 *
 * - If the new dir already exists, the legacy dir is left in place untouched
 *   and a warning is logged for manual cleanup.
 * - If only the legacy dir exists, it is renamed.
 * - If neither exists, this is a no-op.
 */
async function maybeMigrateLegacy(
  legacyUserDir: string,
  newUserDir: string,
): Promise<void> {
  if (!existsSync(legacyUserDir)) return;
  if (existsSync(newUserDir)) {
    console.warn(
      `hudsonkit/server: both legacy ${legacyUserDir} and new ${newUserDir} exist; ` +
      'leaving both untouched. Manual cleanup required.',
    );
    return;
  }
  const { rename, mkdir: mkdirAsync } = await import('node:fs/promises');
  await mkdirAsync(join(newUserDir, '..'), { recursive: true });
  await rename(legacyUserDir, newUserDir);
}

export function appStorage(appId: string, options: AppStorageOptions = {}): AppStorage {
  validateNamespace(appId, 'appId');
  const storageId = options.dataDir ?? appId;
  if (options.dataDir != null) validateNamespace(options.dataDir, 'dataDir');

  const homeDir = options.homeDir ?? process.env.HOME ?? '';
  const projectDir = options.projectDir ?? process.cwd();

  const userDir = join(homeDir, 'hudson', storageId, '.data');
  const seedDir = join(projectDir, '.data', storageId);

  let ensuredOnce = false;
  const legacyMigrationKey = options.migrateFromDataDir ?? null;
  if (legacyMigrationKey != null) validateNamespace(legacyMigrationKey, 'migrateFromDataDir');

  const storage: AppStorage = {
    appId,
    storageId,
    userDir,
    seedDir,

    async ensure(rel) {
      const target = resolveWithin(userDir, rel, 'userDir');
      if (!ensuredOnce && legacyMigrationKey != null) {
        const legacyUserDir = join(homeDir, 'hudson', legacyMigrationKey, '.data');
        await maybeMigrateLegacy(legacyUserDir, userDir);
      }
      await mkdir(target, { recursive: true });
      ensuredOnce = true;
      return target;
    },

    paths(rel) {
      return {
        user: resolveWithin(userDir, rel, 'userDir'),
        seed: resolveWithin(seedDir, rel, 'seedDir'),
      };
    },

    async seedIfEmpty(opts = {}) {
      const { rel, match, copyMissing, fallback } = opts;
      const matcher = match ?? (() => true);
      const targetUserDir = await storage.ensure(rel);
      const targetSeedDir = resolveWithin(seedDir, rel, 'seedDir');

      if (copyMissing && existsSync(targetSeedDir)) {
        const existing = new Set(await listMatchingFiles(targetUserDir, matcher));
        const seeds = await listMatchingFiles(targetSeedDir, matcher);
        const missing = seeds.filter((name) => !existing.has(name));
        if (missing.length > 0) {
          await Promise.all(
            missing.map((name) =>
              copyFile(join(targetSeedDir, name), join(targetUserDir, name)),
            ),
          );
        }
      }

      if (fallback) {
        const remaining = await listMatchingFiles(targetUserDir, matcher);
        if (remaining.length === 0) {
          await fallback({ userDir: targetUserDir, seedDir: targetSeedDir });
        }
      }
    },
  };

  return storage;
}
