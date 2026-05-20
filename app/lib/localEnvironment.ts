import { existsSync, readFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseEnv } from 'node:util';
import { clearCredentialCache } from '@/app/api/ai/providers';
import { clearHudsonVoxVoiceCache } from '@/app/lib/tts/voxBridge';
import {
  deleteHudsonLocalSecret,
  getHudsonLocalSecretVaultInfo,
  HUDSON_SECRET_ENV_KEYS,
  isHudsonSecretEnvKey,
  loadHudsonLocalSecrets,
  setHudsonLocalSecret,
} from './localSecretVault';

export interface HudsonLocalEnvironmentEntry {
  key: string;
  value: string;
  maskedValue: string;
  source: 'vault' | 'env';
  sensitive: boolean;
  hasValue: boolean;
}

export interface HudsonLocalEnvironmentStore {
  path: string;
  vaultPath: string;
  vaultKeyStorage: 'env' | 'macos-keychain' | 'file';
  entries: HudsonLocalEnvironmentEntry[];
  suggestedKeys: string[];
}

export const HUDSON_ENV_LOCAL_PATH = join(process.cwd(), '.env.local');

const HUDSON_ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HUDSON_SUGGESTED_ENV_KEYS = [
  ...HUDSON_SECRET_ENV_KEYS,
  'AI_DEFAULT_MODE',
  'AI_CLI_COMMAND',
] as const;

const INITIAL_ENV_LOCAL = readHudsonEnvLocalSync();
const INITIAL_VAULT_ENV = readHudsonVaultSecretsSync();
const ORIGINAL_RUNTIME_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !(key in INITIAL_ENV_LOCAL) && !(key in INITIAL_VAULT_ENV)),
);
let managedHudsonEnvKeys = new Set([...Object.keys(INITIAL_ENV_LOCAL), ...Object.keys(INITIAL_VAULT_ENV)]);

export function isValidHudsonEnvKey(key: string): boolean {
  return HUDSON_ENV_KEY_PATTERN.test(key);
}

export function maskHudsonEnvValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function parseHudsonEnvFile(text: string): Record<string, string> {
  const parsed = parseEnv(text);
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string') result[k] = v;
  }
  return result;
}

export function serializeHudsonEnvValue(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value) ? value : JSON.stringify(value);
}

export function updateHudsonEnvFile(text: string, key: string, value: string | null): string {
  const lines = text.length > 0 ? text.split(/\r?\n/) : [];
  const nextLines: string[] = [];
  let replaced = false;

  for (const line of lines) {
    const eq = line.indexOf('=');
    const currentKey = eq === -1 ? '' : line.slice(0, eq).trim();

    if (currentKey === key) {
      if (!replaced && value !== null) {
        nextLines.push(`${key}=${serializeHudsonEnvValue(value)}`);
        replaced = true;
      }
      continue;
    }

    nextLines.push(line);
  }

  if (!replaced && value !== null) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1]?.trim()) {
      nextLines.push('');
    }
    nextLines.push(`${key}=${serializeHudsonEnvValue(value)}`);
  }

  const normalized = nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  return normalized ? `${normalized}\n` : '';
}

function readHudsonEnvLocalSync(): Record<string, string> {
  if (!existsSync(HUDSON_ENV_LOCAL_PATH)) {
    return {};
  }

  try {
    return parseHudsonEnvFile(readFileSync(HUDSON_ENV_LOCAL_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function readHudsonEnvLocalMap(): Promise<Record<string, string>> {
  try {
    return parseHudsonEnvFile(await readFile(HUDSON_ENV_LOCAL_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function migrateHudsonEnvSecretsToVault(envLocal: Record<string, string>): Promise<Record<string, string>> {
  const secretKeys = Object.keys(envLocal).filter(isHudsonSecretEnvKey);
  if (secretKeys.length === 0) return envLocal;

  const existingText = existsSync(HUDSON_ENV_LOCAL_PATH)
    ? await readFile(HUDSON_ENV_LOCAL_PATH, 'utf-8')
    : '';
  let nextText = existingText;

  for (const key of secretKeys) {
    setHudsonLocalSecret(key, envLocal[key]);
    nextText = updateHudsonEnvFile(nextText, key, null);
  }

  if (nextText !== existingText) {
    await writeFile(HUDSON_ENV_LOCAL_PATH, nextText, 'utf-8');
  }

  return parseHudsonEnvFile(nextText);
}

function readHudsonVaultSecretsSync(): Record<string, string> {
  try {
    return loadHudsonLocalSecrets();
  } catch {
    return {};
  }
}

function applyHudsonLocalEnvironment(
  envLocal: Record<string, string>,
  vaultSecrets: Record<string, string>,
) {
  const effectiveEnv = { ...envLocal, ...vaultSecrets };
  const nextKeys = new Set(Object.keys(effectiveEnv));
  const impactedKeys = new Set([...managedHudsonEnvKeys, ...nextKeys]);

  for (const key of impactedKeys) {
    if (key in effectiveEnv) {
      process.env[key] = effectiveEnv[key];
      continue;
    }

    if (key in ORIGINAL_RUNTIME_ENV) {
      const originalValue = ORIGINAL_RUNTIME_ENV[key];
      if (typeof originalValue === 'string') {
        process.env[key] = originalValue;
      } else {
        delete process.env[key];
      }
      continue;
    }

    delete process.env[key];
  }

  managedHudsonEnvKeys = nextKeys;
}

function refreshHudsonEnvironmentCaches() {
  clearCredentialCache();
  clearHudsonVoxVoiceCache();
}

function toHudsonLocalEnvironmentStore(
  envLocal: Record<string, string>,
  vaultSecrets: Record<string, string>,
): HudsonLocalEnvironmentStore {
  const vaultInfo = getHudsonLocalSecretVaultInfo();
  const keys = [...new Set([...Object.keys(envLocal), ...Object.keys(vaultSecrets)])]
    .sort((left, right) => left.localeCompare(right));

  return {
    path: HUDSON_ENV_LOCAL_PATH,
    vaultPath: vaultInfo.path,
    vaultKeyStorage: vaultInfo.keyStorage,
    entries: keys
      .map((key) => {
        const sensitive = isHudsonSecretEnvKey(key);
        const hasVaultValue = key in vaultSecrets;
        const value = hasVaultValue ? vaultSecrets[key] : envLocal[key] ?? '';
        return {
          key,
          value: hasVaultValue ? '' : value,
          maskedValue: maskHudsonEnvValue(value),
          source: hasVaultValue ? 'vault' as const : 'env' as const,
          sensitive,
          hasValue: value.length > 0,
        };
      }),
    suggestedKeys: HUDSON_SUGGESTED_ENV_KEYS.filter(key => !(key in envLocal) && !(key in vaultSecrets)),
  };
}

export async function getHudsonLocalEnvironmentStore(): Promise<HudsonLocalEnvironmentStore> {
  const envLocal = await migrateHudsonEnvSecretsToVault(await readHudsonEnvLocalMap());
  const vaultSecrets = loadHudsonLocalSecrets();
  applyHudsonLocalEnvironment(envLocal, vaultSecrets);
  refreshHudsonEnvironmentCaches();
  return toHudsonLocalEnvironmentStore(envLocal, vaultSecrets);
}

export async function setHudsonLocalEnvironmentValue(
  key: string,
  value: string,
): Promise<HudsonLocalEnvironmentStore> {
  const normalizedKey = key.trim();
  if (!isValidHudsonEnvKey(normalizedKey)) {
    throw new Error('Environment variable names must match [A-Za-z_][A-Za-z0-9_]*.');
  }

  const existingText = existsSync(HUDSON_ENV_LOCAL_PATH)
    ? await readFile(HUDSON_ENV_LOCAL_PATH, 'utf-8')
    : '';
  const nextText = isHudsonSecretEnvKey(normalizedKey)
    ? updateHudsonEnvFile(existingText, normalizedKey, null)
    : updateHudsonEnvFile(existingText, normalizedKey, value);

  await writeFile(HUDSON_ENV_LOCAL_PATH, nextText, 'utf-8');
  if (isHudsonSecretEnvKey(normalizedKey)) {
    setHudsonLocalSecret(normalizedKey, value);
  }

  const envLocal = parseHudsonEnvFile(nextText);
  const vaultSecrets = loadHudsonLocalSecrets();
  applyHudsonLocalEnvironment(envLocal, vaultSecrets);
  refreshHudsonEnvironmentCaches();

  return toHudsonLocalEnvironmentStore(envLocal, vaultSecrets);
}

export async function deleteHudsonLocalEnvironmentValue(
  key: string,
): Promise<HudsonLocalEnvironmentStore> {
  const normalizedKey = key.trim();
  if (!isValidHudsonEnvKey(normalizedKey)) {
    throw new Error('Environment variable names must match [A-Za-z_][A-Za-z0-9_]*.');
  }

  const existingText = existsSync(HUDSON_ENV_LOCAL_PATH)
    ? await readFile(HUDSON_ENV_LOCAL_PATH, 'utf-8')
    : '';
  const nextText = updateHudsonEnvFile(existingText, normalizedKey, null);

  await writeFile(HUDSON_ENV_LOCAL_PATH, nextText, 'utf-8');
  if (isHudsonSecretEnvKey(normalizedKey)) {
    deleteHudsonLocalSecret(normalizedKey);
  }

  const envLocal = parseHudsonEnvFile(nextText);
  const vaultSecrets = loadHudsonLocalSecrets();
  applyHudsonLocalEnvironment(envLocal, vaultSecrets);
  refreshHudsonEnvironmentCaches();

  return toHudsonLocalEnvironmentStore(envLocal, vaultSecrets);
}

applyHudsonLocalEnvironment(INITIAL_ENV_LOCAL, INITIAL_VAULT_ENV);
