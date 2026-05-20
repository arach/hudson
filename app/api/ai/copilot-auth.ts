import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const COPILOT_CONFIG_DIR = join(homedir(), '.config', 'github-copilot');
const COPILOT_APPS_FILE = join(COPILOT_CONFIG_DIR, 'apps.json');
const COPILOT_TOKEN_CACHE = join(COPILOT_CONFIG_DIR, 'chat-token.json');
const DEFAULT_COPILOT_API_BASE = 'https://api.githubcopilot.com';
const TOKEN_REFRESH_SKEW_SECONDS = 60;

const COPILOT_HEADERS = {
  'Content-Type': 'application/json',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
  'User-Agent': 'GitHubCopilotChat/0.35.0',
};

export interface CopilotChatToken {
  token: string;
  apiBaseUrl: string;
  expiresAt: number;
}

interface CopilotTokenCache {
  token?: unknown;
  expires_at?: unknown;
  endpoints?: {
    api?: unknown;
  };
}

interface CopilotAppsFile {
  [key: string]: {
    oauth_token?: unknown;
  } | undefined;
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
}

export function readCachedCopilotChatToken(minTtlSeconds = TOKEN_REFRESH_SKEW_SECONDS): CopilotChatToken | null {
  const cache = readJsonFile<CopilotTokenCache>(COPILOT_TOKEN_CACHE);
  if (!cache || typeof cache.token !== 'string' || typeof cache.expires_at !== 'number') return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cache.expires_at <= nowSeconds + minTtlSeconds) return null;

  return {
    token: cache.token,
    apiBaseUrl: typeof cache.endpoints?.api === 'string'
      ? cache.endpoints.api
      : DEFAULT_COPILOT_API_BASE,
    expiresAt: cache.expires_at,
  };
}

function readCopilotOAuthToken() {
  const apps = readJsonFile<CopilotAppsFile>(COPILOT_APPS_FILE);
  const token = apps?.[`github.com:${COPILOT_CLIENT_ID}`]?.oauth_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function resolveCopilotChatToken(): Promise<CopilotChatToken> {
  const cached = readCachedCopilotChatToken();
  if (cached) return cached;

  const oauthToken = readCopilotOAuthToken();
  if (!oauthToken) {
    throw new Error(`Missing Copilot OAuth token at ${COPILOT_APPS_FILE}.`);
  }

  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${oauthToken}`,
      ...COPILOT_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to mint Copilot chat token: HTTP ${response.status}.`);
  }

  const data = await response.json() as CopilotTokenCache;
  if (typeof data.token !== 'string' || typeof data.expires_at !== 'number') {
    throw new Error('Copilot token response was missing token fields.');
  }

  writeJsonFile(COPILOT_TOKEN_CACHE, data);

  return {
    token: data.token,
    apiBaseUrl: typeof data.endpoints?.api === 'string'
      ? data.endpoints.api
      : DEFAULT_COPILOT_API_BASE,
    expiresAt: data.expires_at,
  };
}

export async function fetchCopilotChatModels() {
  const auth = await resolveCopilotChatToken();
  const response = await fetch(`${auth.apiBaseUrl}/models`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...COPILOT_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Copilot model fetch failed: HTTP ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}
