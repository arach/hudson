/**
 * Hudson AI provider registry.
 *
 * Uses the same pattern as @arach/ai but imports from Hudson's own
 * AI SDK packages to avoid version mismatches with the ai-sdk/react hooks.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type ProviderName = 'minimax' | 'anthropic' | 'openai' | 'groq' | 'xai';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  minimax: 'MiniMax-M2.7',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-4-1-fast',
};

interface CredentialStore {
  minimax?: string;
  anthropic?: string;
  openai?: string;
  groq?: string;
  xai?: string;
}

let _cachedCreds: CredentialStore | null = null;

export function loadCredentials(): CredentialStore {
  if (_cachedCreds) return _cachedCreds;
  const creds: CredentialStore = {};

  if (process.env.MINIMAX_API_KEY) creds.minimax = process.env.MINIMAX_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) creds.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) creds.openai = process.env.OPENAI_API_KEY;
  if (process.env.GROQ_API_KEY) creds.groq = process.env.GROQ_API_KEY;
  if (process.env.XAI_API_KEY) creds.xai = process.env.XAI_API_KEY;

  const latticesConfig = join(homedir(), '.lattices', 'inference.json');
  if (existsSync(latticesConfig)) {
    try {
      const cfg = JSON.parse(readFileSync(latticesConfig, 'utf-8'));
      if (cfg.keys) {
        for (const k of Object.keys(creds) as (keyof CredentialStore)[]) {
          if (!creds[k] && cfg.keys[k]) creds[k] = cfg.keys[k];
        }
      }
    } catch { /* ignore */ }
  }

  _cachedCreds = creds;
  return creds;
}

export function clearCredentialCache() { _cachedCreds = null; }

export function availableProviders(): ProviderName[] {
  const creds = loadCredentials();
  return (Object.keys(DEFAULT_MODELS) as ProviderName[]).filter(k => !!creds[k]);
}

function getModel(provider: ProviderName, modelId: string) {
  const creds = loadCredentials();
  switch (provider) {
    case 'minimax': {
      const minimax = createOpenAI({ baseURL: 'https://api.minimax.io/v1', apiKey: creds.minimax });
      return minimax.chat(modelId);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: creds.anthropic });
      return anthropic(modelId);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: creds.openai });
      return openai(modelId);
    }
    case 'groq': {
      const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: creds.groq });
      return groq(modelId);
    }
    case 'xai': {
      const xai = createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: creds.xai });
      return xai(modelId);
    }
  }
}

export function resolveModel(provider?: string, model?: string) {
  const p = (provider || 'minimax') as ProviderName;
  const m = model || DEFAULT_MODELS[p] || DEFAULT_MODELS.minimax;
  const creds = loadCredentials();
  if (!creds[p]) {
    const available = availableProviders();
    throw new Error(
      `No API key for provider "${p}". Set ${p.toUpperCase()}_API_KEY in .env.local or ~/.lattices/inference.json. Available: ${available.length > 0 ? available.join(', ') : 'none'}`,
    );
  }
  return getModel(p, m);
}
