// ---------------------------------------------------------------------------
// The harnesses the Scout backend can drive, and the CLI each one needs.
// ---------------------------------------------------------------------------

import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/** `claude` runs through the Claude Code CLI; the rest through @openscout/agent-sessions/local. */
export type ScoutHarness = 'claude' | 'codex' | 'pi' | 'grok' | 'kimi' | 'cursor' | 'opencode';

export const SCOUT_HARNESSES: readonly ScoutHarness[] = ['claude', 'codex', 'pi', 'grok', 'kimi', 'cursor', 'opencode'];

/** Executables whose presence means the harness is installed, preferred first. */
export const HARNESS_BINARIES: Record<ScoutHarness, readonly string[]> = {
  claude: ['claude'],
  codex: ['codex'],
  pi: ['pi'],
  grok: ['grok'],
  kimi: ['kimi'],
  cursor: ['cursor-agent'],
  // OpenCode product V2 ships as `opencode2`; V1's `opencode` still runs over ACP.
  opencode: ['opencode2', 'opencode'],
};

export const HARNESS_LABELS: Record<ScoutHarness, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  pi: 'Pi',
  grok: 'Grok',
  kimi: 'Kimi',
  cursor: 'Cursor',
  opencode: 'OpenCode',
};

/** Resolve a binary on PATH, or null. */
export function which(bin: string, path = process.env.PATH ?? ''): string | null {
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The OpenCode CLI to shell out to. Known install locations come before PATH,
 * the same order agent-sessions uses, because PATH can hold a stale `opencode2`
 * (`bun run` puts every ancestor node_modules/.bin first, and the old
 * @opencode-ai/cli betas shipped a bin by that name).
 */
export function resolveOpenCodeBin(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.OPENCODE_V2_BIN?.trim();
  if (explicit && executable(explicit)) return explicit;
  const home = env.HOME || homedir();
  const known = [
    '/opt/homebrew/bin/opencode2',
    '/usr/local/bin/opencode2',
    join(home, '.opencode', 'bin', 'opencode2'),
    join(home, '.local', 'bin', 'opencode2'),
    join(home, '.bun', 'bin', 'opencode2'),
  ];
  return known.find(executable) ?? which('opencode2', env.PATH) ?? which('opencode', env.PATH);
}
