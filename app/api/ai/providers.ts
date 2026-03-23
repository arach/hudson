/**
 * Hudson AI provider registry — thin layer over Vercel AI SDK.
 *
 * Ported from Lattices lib/infer.ts. Supports multiple providers via
 * credential loading from env vars → ~/.lattices/inference.json fallback.
 *
 * MiniMax uses OpenAI-compatible API via createOpenAI with custom baseURL.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────────

export type ProviderName = 'minimax' | 'anthropic' | 'openai' | 'groq' | 'google' | 'xai';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  minimax: 'MiniMax-M2.7',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  google: 'gemini-2.0-flash',
  xai: 'grok-4-1-fast',
};

// ── Credential loading ─────────────────────────────────────────────

interface CredentialStore {
  minimax?: string;
  anthropic?: string;
  openai?: string;
  groq?: string;
  google?: string;
  xai?: string;
}

let _cachedCreds: CredentialStore | null = null;

export function loadCredentials(): CredentialStore {
  if (_cachedCreds) return _cachedCreds;

  const creds: CredentialStore = {};

  // Layer 1: env vars (highest priority)
  if (process.env.MINIMAX_API_KEY) creds.minimax = process.env.MINIMAX_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) creds.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) creds.openai = process.env.OPENAI_API_KEY;
  if (process.env.GROQ_API_KEY) creds.groq = process.env.GROQ_API_KEY;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) creds.google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (process.env.XAI_API_KEY) creds.xai = process.env.XAI_API_KEY;

  // Layer 2: ~/.lattices/inference.json (shared with Lattices project)
  const latticesConfig = join(homedir(), '.lattices', 'inference.json');
  if (existsSync(latticesConfig)) {
    try {
      const cfg = JSON.parse(readFileSync(latticesConfig, 'utf-8'));
      if (cfg.keys) {
        if (!creds.minimax && cfg.keys.minimax) creds.minimax = cfg.keys.minimax;
        if (!creds.anthropic && cfg.keys.anthropic) creds.anthropic = cfg.keys.anthropic;
        if (!creds.openai && cfg.keys.openai) creds.openai = cfg.keys.openai;
        if (!creds.groq && cfg.keys.groq) creds.groq = cfg.keys.groq;
        if (!creds.google && cfg.keys.google) creds.google = cfg.keys.google;
        if (!creds.xai && cfg.keys.xai) creds.xai = cfg.keys.xai;
      }
    } catch { /* ignore parse errors */ }
  }

  _cachedCreds = creds;
  return creds;
}

export function clearCredentialCache() {
  _cachedCreds = null;
}

export function availableProviders(): ProviderName[] {
  const creds = loadCredentials();
  return (Object.keys(creds) as ProviderName[]).filter(k => !!creds[k]);
}

// ── Provider factory ───────────────────────────────────────────────

function getModel(provider: ProviderName, modelId: string) {
  const creds = loadCredentials();

  switch (provider) {
    case 'minimax': {
      const minimax = createOpenAI({
        baseURL: 'https://api.minimax.io/v1',
        apiKey: creds.minimax,
      });
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
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: creds.groq,
      });
      return groq(modelId);
    }
    case 'google': {
      // Google requires @ai-sdk/google — lazy import to avoid errors if not installed
      throw new Error('Google provider requires @ai-sdk/google package. Install with: bun add @ai-sdk/google');
    }
    case 'xai': {
      // xAI uses OpenAI-compatible API
      const xai = createOpenAI({
        baseURL: 'https://api.x.ai/v1',
        apiKey: creds.xai,
      });
      return xai(modelId);
    }
  }
}

/**
 * Resolve a provider + model into an AI SDK model instance.
 * Falls back to minimax if no provider specified.
 */
export function resolveModel(provider?: string, model?: string) {
  const p = (provider || 'minimax') as ProviderName;
  const m = model || DEFAULT_MODELS[p] || DEFAULT_MODELS.minimax;

  const creds = loadCredentials();
  if (!creds[p]) {
    throw new Error(
      `No API key for provider "${p}". Set ${p.toUpperCase()}_API_KEY in .env.local or ~/.lattices/inference.json`,
    );
  }

  return getModel(p, m);
}
