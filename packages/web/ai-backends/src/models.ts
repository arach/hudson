// ---------------------------------------------------------------------------
// Available models
//
// "What models can this host actually serve right now?" — pi-ai's model registry
// filtered to the providers a host holds a credential for. No hand-maintained
// catalog; the registry is the source of truth. Standalone hosts call this to
// populate a model picker instead of re-deriving it per app.
// ---------------------------------------------------------------------------

import { getProviders, getModels, getEnvApiKey } from '@earendil-works/pi-ai';

export interface AvailableModel {
  /** pi-ai provider id, e.g. `minimax`, `openai-codex`, `anthropic`, `openrouter`. */
  provider: string;
  /** pi-ai model id (keyed under the provider). */
  model: string;
  /** Friendly name from the registry, if any. */
  name?: string;
  /** Zero input + output cost (e.g. OpenRouter `:free` models). */
  free: boolean;
  contextWindow?: number;
  reasoning?: boolean;
}

export interface ListAvailableModelsOptions {
  /**
   * Whether a credential is held for a provider. Defaults to an env check via
   * pi-ai's provider→env-var mapping. Hosts with non-env credentials (keychain,
   * vault) pass their own predicate.
   */
  hasCredential?: (provider: string) => boolean;
  /** Optional extra filter on which providers to consider at all. */
  includeProvider?: (provider: string) => boolean;
}

interface RegistryModel {
  id: string;
  name?: string;
  cost?: { input?: number; output?: number };
  contextWindow?: number;
  reasoning?: boolean;
}

/**
 * Enumerate the models this host can serve: every model from every provider it
 * holds a credential for, flattened with cost/context metadata. Providers pi-ai
 * can't enumerate are skipped silently.
 */
export function listAvailableModels(opts: ListAvailableModelsOptions = {}): AvailableModel[] {
  const hasCredential = opts.hasCredential ?? ((provider: string) => Boolean(getEnvApiKey(provider)));
  const includeProvider = opts.includeProvider ?? (() => true);

  const out: AvailableModel[] = [];
  for (const provider of getProviders()) {
    if (!includeProvider(provider)) continue;
    if (!hasCredential(provider)) continue;

    let models: RegistryModel[];
    try {
      models = getModels(provider) as RegistryModel[];
    } catch {
      continue;
    }

    for (const m of models) {
      const free = Boolean(m.cost && m.cost.input === 0 && m.cost.output === 0);
      out.push({
        provider,
        model: m.id,
        name: m.name,
        free,
        contextWindow: m.contextWindow,
        reasoning: m.reasoning,
      });
    }
  }
  return out;
}
