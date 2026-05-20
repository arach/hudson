// Shared process discovery — used by `hudsonkit status` and `hudsonkit panic`.
// Identifies Hudson-related processes via three signals (in order of reliability):
//
//   1. HUDSONKIT_* env vars present in the process environment (most reliable;
//      requires Hudson wrappers to set them — see Layer 1 item #2 in the
//      runaway hardening plan).
//   2. Run-registry JSON entries under ~/Library/Application Support/HudsonKit/runs/
//      (also Layer 1 item #2; not written yet, but the reader is forward-compatible).
//   3. Command-line / cwd heuristics: `next dev`, `tsup --watch`, vitest watch, etc.
//      executed inside a hudson checkout.
//
// All three are unioned. The caller decides whether to dry-run or actually signal.

import { execSync, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import process from 'node:process';

const HUDSONKIT_ENV_KEYS = ['HUDSONKIT_RUN_ID', 'HUDSONKIT_ROLE', 'HUDSONKIT_ROOT'];

function runsDir() {
  return join(homedir(), 'Library', 'Application Support', 'HudsonKit', 'runs');
}

function readRunRegistry() {
  const dir = runsDir();
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (data && typeof data.pid === 'number') {
        entries.push({ source: 'registry', file: join(dir, name), ...data });
      }
    } catch {}
  }
  return entries;
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function listProcessesPs() {
  // -A: all users · -o: format. Keep columns predictable.
  try {
    const out = execSync('ps -A -o pid=,ppid=,etime=,user=,command=', {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').filter(Boolean).map(line => {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
      if (!m) return null;
      const [, pid, ppid, etime, user, command] = m;
      return { pid: Number(pid), ppid: Number(ppid), etime, user, command };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function readProcEnvLinux(pid) {
  try {
    const buf = readFileSync(`/proc/${pid}/environ`);
    const env = {};
    for (const chunk of buf.toString('utf8').split('\0')) {
      const i = chunk.indexOf('=');
      if (i > 0) env[chunk.slice(0, i)] = chunk.slice(i + 1);
    }
    return env;
  } catch { return null; }
}

function readEnvDarwin(pid) {
  // `ps -E` on macOS prints env vars inline in COMMAND. Parse them out.
  try {
    const out = execFileSync('ps', ['-E', '-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const env = {};
    // Heuristic: KEY=VALUE tokens separated by whitespace. Pull out the
    // HUDSONKIT_* ones; ignore the rest. Real env values may contain spaces so
    // we limit ourselves to recognised keys.
    for (const key of HUDSONKIT_ENV_KEYS) {
      const re = new RegExp(`\\b${key}=([^\\s]+)`);
      const m = out.match(re);
      if (m) env[key] = m[1];
    }
    return env;
  } catch { return null; }
}

function readProcessEnv(pid) {
  if (platform() === 'linux') return readProcEnvLinux(pid);
  if (platform() === 'darwin') return readEnvDarwin(pid);
  return null;
}

function classifyByCommand(command, cwd) {
  if (!command) return null;
  if (command.length > 1024) return null;
  if (/\bcomputer-use\b/i.test(command)) return null;
  if (/--append-system-prompt/.test(command)) return null;

  const looksLikeHudson = /[\/\s]hudson(kit)?[\/\s]/i.test(command);

  if (/\bnext\s+dev\b/.test(command) || /\.bin\/next\b/.test(command)) {
    if (looksLikeHudson) return { role: 'next-dev', confidence: 'medium' };
  }
  if (/\btsup\b.*--watch\b/.test(command) || /\.bin\/tsup\b.*--watch\b/.test(command)) {
    if (looksLikeHudson || /hudsonkit/.test(command)) return { role: 'tsup-watch', confidence: 'medium' };
  }
  if (/\bvitest\b.*\bwatch\b/.test(command) && looksLikeHudson) {
    return { role: 'vitest-watch', confidence: 'low' };
  }
  if (/embed-worker\b/.test(command) && /\bwrangler\b/.test(command)) {
    return { role: 'embed-worker', confidence: 'medium' };
  }
  return null;
}

export function discoverHudsonProcesses({ includeSelf = false } = {}) {
  const selfPid = process.pid;
  const psRows = listProcessesPs();
  const registry = readRunRegistry();

  const byPid = new Map();

  // From command-line heuristics
  for (const row of psRows) {
    if (!includeSelf && row.pid === selfPid) continue;
    const classified = classifyByCommand(row.command);
    if (!classified) continue;
    byPid.set(row.pid, {
      pid: row.pid,
      ppid: row.ppid,
      etime: row.etime,
      user: row.user,
      command: row.command,
      role: classified.role,
      confidence: classified.confidence,
      source: 'command-match',
    });
  }

  // Enrich with env vars (highest confidence)
  for (const row of psRows) {
    if (!includeSelf && row.pid === selfPid) continue;
    const env = readProcessEnv(row.pid);
    if (!env) continue;
    const matched = HUDSONKIT_ENV_KEYS.some(k => env[k]);
    if (!matched) continue;
    const existing = byPid.get(row.pid) ?? {
      pid: row.pid, ppid: row.ppid, etime: row.etime, user: row.user, command: row.command,
      source: 'env-match',
    };
    existing.role = env.HUDSONKIT_ROLE ?? existing.role ?? 'hudsonkit';
    existing.runId = env.HUDSONKIT_RUN_ID;
    existing.root = env.HUDSONKIT_ROOT;
    existing.confidence = 'high';
    existing.source = existing.source === 'command-match' ? 'env+command' : 'env-match';
    byPid.set(row.pid, existing);
  }

  // Merge registry entries (only if PID still alive)
  for (const entry of registry) {
    if (!pidAlive(entry.pid)) continue;
    const existing = byPid.get(entry.pid);
    if (existing) {
      existing.runId = existing.runId ?? entry.runId;
      existing.root = existing.root ?? entry.root;
      existing.role = existing.role ?? entry.role;
      existing.confidence = 'high';
      existing.registryFile = entry.file;
    } else {
      const row = psRows.find(r => r.pid === entry.pid);
      byPid.set(entry.pid, {
        pid: entry.pid,
        ppid: row?.ppid,
        etime: row?.etime,
        user: row?.user,
        command: row?.command,
        role: entry.role ?? 'hudsonkit',
        runId: entry.runId,
        root: entry.root,
        confidence: 'high',
        source: 'registry',
        registryFile: entry.file,
      });
    }
  }

  return [...byPid.values()].sort((a, b) => a.pid - b.pid);
}

export { runsDir };
