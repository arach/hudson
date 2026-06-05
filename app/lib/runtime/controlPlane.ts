import { appendFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { RuntimeControlCommand, RuntimeControlPaths, RuntimeControlResponse } from './types';
import { resolveRuntimeProfile, RUNTIME_CONTROL_PROFILES } from './paths';

const DEFAULT_WAIT_MS = 4_000;
const POLL_MS = 75;
const NATIVE_COMMAND_KIND = 'hudson.vantage.command';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readTailBytes(path: string, maxBytes = 64_000): Promise<string> {
  try {
    const fileStat = await stat(path);
    const start = Math.max(0, fileStat.size - maxBytes);
    const handle = await import('node:fs/promises').then(mod => mod.open(path, 'r'));
    try {
      const length = fileStat.size - start;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      return buffer.toString('utf8');
    } finally {
      await handle.close();
    }
  } catch {
    return '';
  }
}

function parseJsonLines<T>(raw: string): T[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is T => entry !== null);
}

export async function sendRuntimeCommand(
  input: {
    action: string;
    profileId?: string;
    waitMs?: number;
    payload?: Record<string, unknown>;
  },
  paths?: RuntimeControlPaths,
): Promise<{ paths: RuntimeControlPaths; response: RuntimeControlResponse | null; timedOut: boolean }> {
  const profile = paths ?? resolveRuntimeProfile(input.profileId);
  const id = `hudson-web-${randomUUID()}`;
  const command: RuntimeControlCommand = {
    apiVersion: 'v0',
    kind: NATIVE_COMMAND_KIND,
    id,
    action: input.action,
    includeNodes: true,
    ...input.payload,
  };

  const before = await readTailBytes(profile.responsePath);
  await appendFile(profile.commandPath, `${JSON.stringify(command)}\n`, 'utf8');

  const deadline = Date.now() + (input.waitMs ?? DEFAULT_WAIT_MS);
  while (Date.now() < deadline) {
    const after = await readTailBytes(profile.responsePath);
    const combined = `${before}\n${after}`;
    const responses = parseJsonLines<RuntimeControlResponse>(combined);
    const match = responses.find(response => response.id === id);
    if (match) {
      return { paths: profile, response: match, timedOut: false };
    }
    await sleep(POLL_MS);
  }

  return { paths: profile, response: null, timedOut: true };
}

export async function probeRuntimeCompanion(profileId?: string) {
  const started = Date.now();
  const result = await sendRuntimeCommand({ action: 'status', profileId, waitMs: 2_500 });
  const latencyMs = Date.now() - started;

  if (!result.response) {
    return {
      online: false,
      profileId: result.paths.id,
      profileLabel: result.paths.label,
      commandPath: result.paths.commandPath,
      responsePath: result.paths.responsePath,
      statePath: result.paths.statePath,
      message: result.timedOut ? 'Companion did not respond to status probe.' : 'No response received.',
      lastCheckedAt: new Date().toISOString(),
      latencyMs,
    };
  }

  return {
    online: result.response.ok,
    profileId: result.paths.id,
    profileLabel: result.paths.label,
    commandPath: result.paths.commandPath,
    responsePath: result.paths.responsePath,
    statePath: result.paths.statePath,
    workspaceID: result.response.workspaceID,
    nodeCount: result.response.nodeCount,
    selectedNodeIDs: result.response.selectedNodeIDs,
    nodes: result.response.nodes,
    message: result.response.message,
    lastCheckedAt: new Date().toISOString(),
    latencyMs,
  };
}

export async function findOnlineRuntimeProfile() {
  for (const profile of RUNTIME_CONTROL_PROFILES) {
    const status = await probeRuntimeCompanion(profile.id);
    if (status.online) return status;
  }

  return probeRuntimeCompanion('hudson-default');
}
