/**
 * Hudson AI provider registry.
 *
 * PiAI owns the provider/model catalog. Hudson keeps only a small compatibility
 * layer for older provider IDs, local auth stores, and clearer error messages.
 */

import {
  getEnvApiKey,
  getModel,
  getModels,
  type Api,
  type KnownProvider,
  type Model,
} from '@earendil-works/pi-ai';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type ProviderName = KnownProvider | 'copilot' | 'github';

export const DEFAULT_MODELS: Record<string, string> = {
  opencode: 'gemini-3-flash',
  minimax: 'MiniMax-M2.7',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-4-1-fast',
  google: 'gemini-3-flash-preview',
  'github-copilot': 'gemini-3-flash-preview',
  copilot: 'gemini-3-flash-preview',
  'openai-codex': 'gpt-5.4',
  github: 'gemini-3-flash-preview',
};

const PROVIDER_ALIASES: Record<string, KnownProvider> = {
  copilot: 'github-copilot',
  github: 'github-copilot',
};

const OPENCODE_AUTH_PROVIDER_KEYS: Record<string, string[]> = {
  opencode: ['opencode'],
  minimax: ['minimax'],
  'minimax-cn': ['minimax-cn-coding-plan'],
  anthropic: ['anthropic'],
  google: ['google'],
  'github-copilot': ['github-copilot'],
  copilot: ['github-copilot'],
};

interface CredentialStore {
  [provider: string]: string | undefined;
}

let cachedCredentials: CredentialStore | null = null;

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function readCredentialValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const key = record.key ?? record.access;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function normalizeProviderName(provider?: string): KnownProvider {
  const requested = provider || 'opencode';
  return (PROVIDER_ALIASES[requested] ?? requested) as KnownProvider;
}

function normalizeModelId(provider: KnownProvider, model?: string): string {
  const fallback = DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.opencode;
  if (!model) return fallback;

  if (provider === 'opencode') {
    if (model === 'gemini-3-flash-preview') return 'gemini-3-flash';
    if (model === 'gemini-3-pro-preview') return 'gemini-3-pro';
    if (model === 'gemini-3.1-pro-preview') return 'gemini-3.1-pro';
  }

  return model;
}

function providerHasModel(provider: KnownProvider, modelId: string): boolean {
  try {
    return getModels(provider).some(model => model.id === modelId);
  } catch {
    return false;
  }
}

function sampleModels(provider: KnownProvider): string {
  try {
    return getModels(provider).slice(0, 8).map(model => model.id).join(', ');
  } catch {
    return 'none';
  }
}

function loadOpencodeCredentials(creds: CredentialStore) {
  const auth = readJsonFile(join(homedir(), '.local', 'share', 'opencode', 'auth.json'));
  if (!auth || typeof auth !== 'object') return;
  const record = auth as Record<string, unknown>;

  for (const [provider, keys] of Object.entries(OPENCODE_AUTH_PROVIDER_KEYS)) {
    for (const key of keys) {
      const value = readCredentialValue(record[key]);
      if (value) {
        creds[normalizeProviderName(provider)] ??= value;
        break;
      }
    }
  }
}

function loadLatticesCredentials(creds: CredentialStore) {
  const cfg = readJsonFile(join(homedir(), '.lattices', 'inference.json'));
  if (!cfg || typeof cfg !== 'object') return;
  const keys = (cfg as { keys?: Record<string, unknown> }).keys;
  if (!keys || typeof keys !== 'object') return;

  for (const [provider, value] of Object.entries(keys)) {
    if (typeof value === 'string' && value.length > 0) {
      creds[normalizeProviderName(provider)] ??= value;
    }
  }
}

export function loadCredentials(): CredentialStore {
  if (cachedCredentials) return cachedCredentials;

  const creds: CredentialStore = {};
  for (const provider of Object.keys(DEFAULT_MODELS)) {
    const normalized = normalizeProviderName(provider);
    const envKey = getEnvApiKey(normalized);
    if (envKey) creds[normalized] = envKey;
  }

  loadOpencodeCredentials(creds);
  loadLatticesCredentials(creds);

  cachedCredentials = creds;
  return creds;
}

export function clearCredentialCache() {
  cachedCredentials = null;
}

export function availableProviders(): KnownProvider[] {
  const creds = loadCredentials();
  return Object.keys(creds).filter(provider => !!creds[provider]) as KnownProvider[];
}

export function resolveApiKey(provider?: string): string | undefined {
  const normalized = normalizeProviderName(provider);
  return loadCredentials()[normalized] ?? getEnvApiKey(normalized);
}

export function resolveModel(provider?: string, model?: string): Model<Api> {
  const normalizedProvider = normalizeProviderName(provider);
  const normalizedModel = normalizeModelId(normalizedProvider, model);

  if (!providerHasModel(normalizedProvider, normalizedModel)) {
    throw new Error(
      `Provider "${normalizedProvider}" does not expose model "${normalizedModel}". Try one of: ${sampleModels(normalizedProvider)}`,
    );
  }

  const apiKey = resolveApiKey(normalizedProvider);
  if (!apiKey && normalizedProvider !== 'google-vertex' && normalizedProvider !== 'amazon-bedrock') {
    const available = availableProviders();
    throw new Error(
      `No API key for provider "${normalizedProvider}". Available local providers: ${available.length > 0 ? available.join(', ') : 'none'}`,
    );
  }

  return getModel(normalizedProvider, normalizedModel as never) as Model<Api>;
}
