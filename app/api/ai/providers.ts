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

export type ProviderName = 'minimax' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'github' | 'google' | 'copilot';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  minimax: 'MiniMax-M2.7',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-4-1-fast',
  github: 'gpt-4o',
  google: 'gemini-2.0-flash',
  copilot: 'gemini-3-flash-preview',  // also: gemini-3-pro-preview, claude-sonnet-4.6, gpt-5.4, gpt-4o
};

interface CredentialStore {
  minimax?: string;
  anthropic?: string;
  openai?: string;
  groq?: string;
  xai?: string;
  github?: string;
  google?: string;
  copilot?: string;
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
  if (process.env.GITHUB_TOKEN) creds.github = process.env.GITHUB_TOKEN;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) creds.google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Copilot OAuth token — from OpenCode's auth store
  if (!creds.copilot) {
    const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
    if (existsSync(authPath)) {
      try {
        const auth = JSON.parse(readFileSync(authPath, 'utf-8'));
        const cp = auth['github-copilot'];
        if (cp?.access) creds.copilot = cp.access;
      } catch { /* ignore */ }
    }
  }

  const latticesConfig = join(homedir(), '.lattices', 'inference.json');
  if (existsSync(latticesConfig)) {
    try {
      const cfg = JSON.parse(readFileSync(latticesConfig, 'utf-8'));
      if (cfg.keys) {
        for (const k of Object.keys(DEFAULT_MODELS) as (keyof CredentialStore)[]) {
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
    case 'github': {
      // GitHub Models API — accessible with Copilot subscription via GITHUB_TOKEN
      // Supports: gemini-2.0-flash, gpt-4o, gpt-4o-mini, Llama, Cohere, etc.
      const gh = createOpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: creds.github,
      });
      return gh.chat(modelId);
    }
    case 'google': {
      // Google AI Studio direct — needs GOOGLE_GENERATIVE_AI_API_KEY
      const google = createOpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: creds.google,
      });
      return google.chat(modelId);
    }
    case 'copilot': {
      // GitHub Copilot API — uses OpenCode's OAuth token
      // Available models: gpt-4o, gpt-4.1, gpt-4o-mini, claude-sonnet-4
      const copilot = createOpenAI({
        baseURL: 'https://api.githubcopilot.com',
        apiKey: creds.copilot,
        headers: { 'Copilot-Integration-Id': 'vscode-chat' },
      });
      return copilot.chat(modelId);
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
