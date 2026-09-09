import { describe, expect, it, vi } from 'vitest';
vi.mock('@hudsonkit/ai/pi-ai', () => ({
  listAvailableModels: () => [
    { provider: 'github-copilot', model: 'future-model', name: 'Future model', contextWindow: 900000 },
    { provider: 'anthropic', model: 'future-anthropic', name: 'Future Anthropic' },
  ],
}));
import { availableCopilotOptions, registryModelOptions } from '../../app/lib/ai-model-catalog';

describe('runtime model discovery', () => {
  it('exposes new runtime models without a Hudson allowlist', () => {
    expect(registryModelOptions()).toEqual([
      { provider: 'copilot', value: 'future-model', label: 'Future model', contextWindow: 900000 },
      { provider: 'anthropic', value: 'future-anthropic', label: 'Future Anthropic', contextWindow: undefined },
    ]);
  });
  it('offers account-visible registered chat models and uses live context limits', () => {
    const chat = (id: string) => ({ id, capabilities: { type: 'chat', limits: { max_context_window_tokens: 123456 } } });
    expect(availableCopilotOptions({ data: [chat('future-model'), chat('unknown'), chat('future-model'), { id: 'embedding' }] }, registryModelOptions()))
      .toEqual([{ provider: 'copilot', value: 'future-model', label: 'Future model', contextWindow: 123456 }]);
  });
  it('preserves an authoritative empty account catalog', () => {
    expect(availableCopilotOptions({ data: [] }, registryModelOptions())).toEqual([]);
  });
  it('rejects malformed responses so the route can use registry fallback', () => {
    expect(() => availableCopilotOptions({}, registryModelOptions())).toThrow('Invalid Copilot model response');
  });
});
