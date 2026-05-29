import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `app/lib/agent-log.ts` declares `import 'server-only'` which throws inside
// vitest's jsdom env; stub the side effect away for tests.
vi.mock('server-only', () => ({}));

// Redirect the log file to a fresh temp path so tests don't touch the real
// `.data/agent-actions.jsonl`. Set before any agent-log import resolves.
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TMP_DIR = mkdtempSync(join(tmpdir(), 'hudson-agent-log-'));
process.env.HUDSON_AGENT_LOG_FILE_OVERRIDE = join(TMP_DIR, 'agent-actions.jsonl');

import {
  appendAgentLog,
  appendAgentObservation,
  appendAgentSpanEnd,
  appendAgentSpanStart,
  appendAgentTaskLog,
  AGENT_LOG_FILE,
  hudsonLog,
  makeTraceId,
  __agentLogInternals,
} from '../../app/lib/agent-log';
import {
  _resetIntentRegistry,
  getIntent,
  intent,
  intentMetaToServerIntent,
  listIntents,
} from '../../app/lib/intent';
import { buildIntentCatalog } from '../../app/lib/intent-catalog';

function readAllLines(): Array<Record<string, unknown>> {
  if (!existsSync(AGENT_LOG_FILE)) return [];
  const raw = readFileSync(AGENT_LOG_FILE, 'utf-8');
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

beforeEach(() => {
  if (existsSync(AGENT_LOG_FILE)) rmSync(AGENT_LOG_FILE);
  _resetIntentRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agent-log redaction', () => {
  it('redacts secret-shaped keys in args/metadata before they hit disk', async () => {
    await appendAgentLog({
      message: 'test',
      args: { token: 'tk_live_abc', input: 'visible' },
      metadata: { nested: { apiKey: 'k_xyz', label: 'shown' } },
    });
    const [entry] = readAllLines();
    const data = entry.data as Record<string, unknown>;
    expect(data.args).toEqual({ token: '[redacted]', input: 'visible' });
    expect(data.metadata).toEqual({ nested: { apiKey: '[redacted]', label: 'shown' } });
  });
});

describe('agent-log size cap', () => {
  it('truncates oversized payload fields instead of writing a multi-MB line', async () => {
    const huge = 'x'.repeat(100_000);
    await appendAgentLog({
      message: 'big payload',
      args: { blob: huge },
      metadata: { blob: huge },
    });
    const [entry] = readAllLines();
    const serialized = JSON.stringify(entry);
    expect(serialized.length).toBeLessThanOrEqual(__agentLogInternals.MAX_LINE_BYTES);
    const data = entry.data as Record<string, unknown>;
    expect(data.args).toBe(__agentLogInternals.TRUNCATION_MARKER);
    expect(data.metadata).toBe(__agentLogInternals.TRUNCATION_MARKER);
  });
});

describe('hudsonLog awaitability', () => {
  it('returns a Promise that resolves once the entry is written', async () => {
    const promise = hudsonLog.info('await me', { args: { ok: true } });
    expect(promise).toBeInstanceOf(Promise);
    await promise;
    expect(readAllLines()).toHaveLength(1);
  });

  it('per-call payload overrides scoped context for collisions', async () => {
    const scoped = hudsonLog.scope({ target: 'scoped-target', playbook: 'pb' });
    await scoped.info('msg', { target: 'override' });
    const [entry] = readAllLines();
    const data = entry.data as Record<string, unknown>;
    expect(data.target).toBe('override');
    expect(data.playbook).toBe('pb');
  });
});

describe('span writers', () => {
  it('emits matched start/end events with the same traceId', async () => {
    const traceId = makeTraceId();
    const startedAt = Date.now();
    await appendAgentSpanStart({ name: 'demo.span', traceId });
    await appendAgentSpanEnd({ name: 'demo.span', traceId, startedAt, status: 'ok' });
    const lines = readAllLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'span', status: 'active', traceId, name: 'demo.span' });
    expect(lines[1]).toMatchObject({ kind: 'span', status: 'ok', traceId, name: 'demo.span' });
    expect(lines[1]).toHaveProperty('durationMs');
  });
});

describe('client observation persistence', () => {
  it('preserves observation ids and redacts payloads for replay dedupe', async () => {
    const written = await appendAgentObservation({
      id: 'client_event_1',
      kind: 'log',
      timestamp: 123,
      category: 'agent-action',
      level: 'info',
      message: 'hudson.agent.action',
      data: {
        source: 'workspace-ai',
        status: 'started',
        action: 'set_environment_variable',
        args: { key: 'OPENAI_API_KEY', value: 'sk-secret' },
      },
    });

    expect(written).toBe(true);
    const [entry] = readAllLines();
    expect(entry).toMatchObject({
      id: 'client_event_1',
      kind: 'log',
      timestamp: 123,
      category: 'agent-action',
      level: 'info',
    });
    const data = entry.data as Record<string, unknown>;
    expect(data.args).toEqual({ key: 'OPENAI_API_KEY', value: '[redacted]' });
  });

  it('rejects unsupported observation kinds', async () => {
    await expect(appendAgentObservation({ kind: 'metric' })).resolves.toBe(false);
    expect(readAllLines()).toHaveLength(0);
  });
});

describe('agent task logging', () => {
  it('writes CLI-safe task envelopes as agent-triggered actions', async () => {
    await appendAgentTaskLog({
      status: 'started',
      source: 'codex',
      origin: 'cli',
      actor: 'codex',
      action: 'logo.create',
      traceId: 'tr_cli',
      prompt: 'Create a logo',
      appId: 'logo',
      workspaceId: 'logo-studio',
    });

    const [entry] = readAllLines();
    expect(entry).toMatchObject({
      kind: 'log',
      category: 'agent-action',
      message: 'agent.task.started',
    });
    expect(entry.data).toMatchObject({
      triggeredBy: 'agent',
      source: 'codex',
      origin: 'cli',
      actor: 'codex',
      status: 'started',
      action: 'logo.create',
      traceId: 'tr_cli',
      appId: 'logo',
      workspaceId: 'logo-studio',
      args: { prompt: 'Create a logo' },
    });
  });

  it('writes terminal task envelopes with the same trace id', async () => {
    await appendAgentTaskLog({
      status: 'started',
      source: 'codex',
      action: 'test.run',
      traceId: 'tr_run',
      prompt: 'Run checks',
    });
    await appendAgentTaskLog({
      status: 'completed',
      source: 'codex',
      action: 'test.run',
      traceId: 'tr_run',
      message: 'Checks passed',
    });
    await appendAgentTaskLog({
      status: 'failed',
      source: 'codex',
      action: 'test.fail',
      traceId: 'tr_fail',
      error: 'Checks failed',
    });

    const lines = readAllLines();
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatchObject({
      kind: 'log',
      level: 'info',
      message: 'Checks passed',
      data: {
        triggeredBy: 'agent',
        source: 'codex',
        status: 'completed',
        action: 'test.run',
        traceId: 'tr_run',
      },
    });
    expect(lines[2]).toMatchObject({
      kind: 'log',
      level: 'error',
      data: {
        status: 'failed',
        action: 'test.fail',
        traceId: 'tr_fail',
        error: { message: 'Checks failed' },
      },
    });
  });
});

describe('intent() wrapper', () => {
  it('registers metadata and returns a callable that emits start + end spans', async () => {
    const compile = intent(
      {
        id: 'test.compile',
        title: 'Test compile',
        description: 'Test compile intent',
        importPath: 'test/fixtures',
        exportName: 'compile',
        params: [{ name: 'source', description: 'src', type: 'string' }],
      },
      async (source: string) => ({ length: source.length }),
    );

    const result = await compile('hello');
    expect(result).toEqual({ length: 5 });

    const lines = readAllLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'span', status: 'active', name: 'test.compile' });
    expect(lines[1]).toMatchObject({ kind: 'span', status: 'ok', name: 'test.compile' });
    expect((lines[0].data as Record<string, unknown>).args).toEqual({ source: 'hello' });
  });

  it('emits an error span and rethrows when the inner function throws', async () => {
    const broken = intent(
      {
        id: 'test.broken',
        title: 'Broken',
        description: 'always fails',
        importPath: 'test/fixtures',
        exportName: 'broken',
      },
      async () => {
        throw new Error('nope');
      },
    );

    await expect(broken()).rejects.toThrow('nope');
    const lines = readAllLines();
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ kind: 'span', status: 'error', name: 'test.broken' });
    expect(lines[1].error).toMatchObject({ message: 'nope' });
  });

  it('warns on a duplicate id registered from a different source file', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    intent(
      {
        id: 'test.dup',
        title: 'A',
        description: 'first',
        importPath: 'a',
        exportName: 'a',
        source: { file: '/tmp/a.ts', line: 1 },
      },
      async () => 1,
    );
    intent(
      {
        id: 'test.dup',
        title: 'B',
        description: 'second',
        importPath: 'b',
        exportName: 'b',
        source: { file: '/tmp/b.ts', line: 1 },
      },
      async () => 2,
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/duplicate id "test\.dup"/);
  });

  it('does not warn when the same source re-registers (HMR replacement)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta = {
      id: 'test.hmr',
      title: 'A',
      description: 'first',
      importPath: 'a',
      exportName: 'a',
      source: { file: '/tmp/same.ts', line: 1 },
    } as const;
    intent(meta, async () => 1);
    intent(meta, async () => 2);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('intentMetaToServerIntent', () => {
  it('maps a registry entry to the ServerIntent catalog shape', () => {
    intent(
      {
        id: 'demo.thing',
        title: 'Demo',
        description: 'demonstrate',
        importPath: 'app/api/demo',
        exportName: 'doIt',
        keywords: ['demo'],
      },
      async () => 'ok',
    );
    const [entry] = listIntents();
    const projected = intentMetaToServerIntent(entry.meta);
    expect(projected).toMatchObject({
      id: 'demo.thing',
      title: 'Demo',
      importPath: 'app/api/demo',
      exportName: 'doIt',
      appId: 'demo',
      category: 'tool',
      keywords: ['demo'],
    });
  });
});

describe('buildIntentCatalog server/UI split', () => {
  const workspace = {
    id: 'test-ws',
    name: 'Test workspace',
    apps: [
      {
        app: {
          id: 'logo',
          name: 'Logo',
          description: 'Logo app',
          intents: [
            {
              commandId: 'logo:open',
              title: 'Open Logo',
              description: 'Open the logo designer.',
              category: 'navigation',
              keywords: ['logo'],
            },
          ],
        },
      },
    ],
  } as unknown as Parameters<typeof buildIntentCatalog>[0];

  it('omits serverIntents when caller passes none', () => {
    const catalog = buildIntentCatalog(workspace);
    expect(catalog.serverIntents).toBeUndefined();
    expect(catalog.index['logo:open']).toBeDefined();
  });

  it('never adds server intents to the UI index', () => {
    intent(
      {
        id: 'logo.compile',
        title: 'Compile',
        description: 'compile a logo body',
        importPath: 'app/api/logo/intents',
        exportName: 'compileLogo',
      },
      async (s: string) => s,
    );
    const serverIntents = listIntents().map(({ meta }) => intentMetaToServerIntent(meta));
    const catalog = buildIntentCatalog(workspace, { serverIntents });
    expect(catalog.index['logo.compile']).toBeUndefined();
    expect(catalog.serverIntents).toHaveLength(1);
    expect(catalog.serverIntents?.[0].id).toBe('logo.compile');
    expect(catalog.index['logo:open']).toBeDefined();
    expect(getIntent('logo.compile')).toBeDefined();
  });
});
