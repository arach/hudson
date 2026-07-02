import { existsSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Resolve the monorepo root by walking up from `start` until we find the
 * SwiftPM manifest — `Package.swift` lives ONLY at the repo root and never
 * moves, so it is a reliable anchor regardless of cwd.
 *
 * This matters because the Next app now runs with cwd = `apps/web`, while
 * `scripts/` runs with cwd = repo root. Routing cwd-relative reads of the
 * unmoved `.data/`, `docs/`, and `packages/` trees through REPO_ROOT makes
 * both surfaces agree on the same absolute paths.
 *
 * Pure node (no next imports) so it stays CLI-safe: `scripts/agent-action.ts`
 * transitively imports it via `agent-log-core`.
 */
export function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'Package.swift'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start; // fallback: never throw
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot();
