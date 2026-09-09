import { listAvailableModels } from '@hudsonkit/ai/pi-ai';
import { AI_PROVIDER_OPTIONS, type AISelectOption } from './ai-models';

interface CopilotModelEntry {
  id?: unknown;
  name?: unknown;
  capabilities?: { type?: unknown; limits?: { max_context_window_tokens?: unknown } };
}

export function registryModelOptions(): AISelectOption[] {
  const providers = new Set(AI_PROVIDER_OPTIONS.map(option =>
    option.value === 'copilot' ? 'github-copilot' : option.value));
  return listAvailableModels({
    hasCredential: () => true,
    includeProvider: provider => providers.has(provider),
  }).map(model => ({
    value: model.model,
    label: model.name ?? model.model,
    provider: model.provider === 'github-copilot' ? 'copilot' : model.provider,
    contextWindow: model.contextWindow,
  }));
}

export function availableCopilotOptions(payload: unknown, registry: AISelectOption[]) {
  const data = (payload as { data?: CopilotModelEntry[] } | null)?.data;
  if (!Array.isArray(data)) throw new Error('Invalid Copilot model response');
  const registered = new Map(registry.filter(m => m.provider === 'copilot').map(m => [m.value, m]));
  const seen = new Set<string>();
  return data.flatMap(entry => {
    if (entry?.capabilities?.type !== 'chat' || typeof entry.id !== 'string' || seen.has(entry.id)) return [];
    const model = registered.get(entry.id);
    if (!model) return []; // A picker option must be routable by the backend.
    seen.add(entry.id);
    const context = entry.capabilities.limits?.max_context_window_tokens;
    return [{ ...model,
      label: typeof entry.name === 'string' ? entry.name : model.label,
      contextWindow: typeof context === 'number' ? context : model.contextWindow,
    }];
  });
}

