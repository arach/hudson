import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// "Batteries-included for standalone hosts" — env credential resolver, the
// available-models helper, and the now pi-executable built-in intents toolset.
// Mock pi-ai's registry surface so the helpers are exercised in isolation.
// ---------------------------------------------------------------------------

const { mockGetEnvApiKey, mockGetProviders, mockGetModels } = vi.hoisted(() => ({
  mockGetEnvApiKey: vi.fn(),
  mockGetProviders: vi.fn(),
  mockGetModels: vi.fn(),
}));

vi.mock('@earendil-works/pi-ai/compat', () => ({
  getEnvApiKey: mockGetEnvApiKey,
  getProviders: mockGetProviders,
  getModels: mockGetModels,
}));

import { envCredentialResolver } from '../credentials';
import { listAvailableModels } from '../models';
import { buildIntentsToolset } from '../toolsets/registry';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('envCredentialResolver', () => {
  it('resolves a provider key from the environment via pi-ai', async () => {
    mockGetEnvApiKey.mockImplementation((p: string) => (p === 'anthropic' ? 'sk-ant' : undefined));
    expect(await envCredentialResolver({ provider: 'anthropic' })).toEqual({ apiKey: 'sk-ant' });
    expect(mockGetEnvApiKey).toHaveBeenCalledWith('anthropic');
  });

  it('returns null when no key is set', async () => {
    mockGetEnvApiKey.mockReturnValue(undefined);
    expect(await envCredentialResolver({ provider: 'openai' })).toBeNull();
  });
});

describe('listAvailableModels', () => {
  it('lists models only for credentialed providers, flagging free vs paid', () => {
    mockGetProviders.mockReturnValue(['anthropic', 'openrouter', 'xai']);
    mockGetEnvApiKey.mockImplementation((p: string) => (p === 'anthropic' || p === 'openrouter' ? 'key' : undefined));
    mockGetModels.mockImplementation((p: string) => {
      if (p === 'anthropic') return [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet', cost: { input: 3, output: 15 }, contextWindow: 200000 }];
      if (p === 'openrouter') return [{ id: 'x/free', name: 'Free', cost: { input: 0, output: 0 }, contextWindow: 8000 }];
      return [];
    });

    const models = listAvailableModels();
    expect(models).toHaveLength(2);
    expect(models.find(m => m.provider === 'xai')).toBeUndefined();
    expect(models.find(m => m.model === 'claude-sonnet-4-6')).toMatchObject({
      provider: 'anthropic',
      free: false,
      contextWindow: 200000,
      name: 'Claude Sonnet',
    });
    expect(models.find(m => m.model === 'x/free')).toMatchObject({ free: true });
  });

  it('honors a custom hasCredential predicate (no env lookup)', () => {
    mockGetProviders.mockReturnValue(['anthropic', 'openai']);
    mockGetModels.mockReturnValue([{ id: 'm', cost: { input: 1, output: 1 } }]);

    const models = listAvailableModels({ hasCredential: (p) => p === 'openai' });
    expect(models.every(m => m.provider === 'openai')).toBe(true);
    expect(mockGetEnvApiKey).not.toHaveBeenCalled();
  });

  it('skips providers pi-ai cannot enumerate', () => {
    mockGetProviders.mockReturnValue(['boom']);
    mockGetEnvApiKey.mockReturnValue('key');
    mockGetModels.mockImplementation(() => { throw new Error('nope'); });
    expect(listAvailableModels()).toEqual([]);
  });
});

describe('buildIntentsToolset — pi-executable dispatch', () => {
  it('emits a dispatch tool with a real schema and a pass-through executor', async () => {
    const ts = buildIntentsToolset([{ commandId: 'grid', title: 'Grid', description: 'Grid view' }]);
    const tools = ts.tools({}) as {
      dispatch: { inputSchema: Record<string, unknown>; execute: (a: Record<string, unknown>) => Promise<unknown> };
    };
    expect(tools.dispatch.inputSchema).toMatchObject({
      properties: { commandId: { type: 'string' } },
      required: ['commandId'],
    });
    expect(typeof tools.dispatch.execute).toBe('function');
    await expect(tools.dispatch.execute({ commandId: 'grid' })).resolves.toEqual({
      dispatched: true,
      commandId: 'grid',
    });
  });
});
