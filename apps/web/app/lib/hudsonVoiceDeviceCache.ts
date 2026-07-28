import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const HUDSON_VOICE_INPUT_DEVICES_PATH_ENV = 'HUDSON_VOICE_INPUT_DEVICES_PATH';
export const HUDSON_VOICE_INPUT_DEVICES_DEFAULT_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Hudson',
  'Voice',
  'input-devices.json',
);

export interface HudsonVoiceCachedDevice {
  id: string;
  name: string;
  isDefault?: boolean;
  isSelected?: boolean;
}

export interface HudsonVoiceInputDeviceCache {
  schemaVersion: number;
  devices: HudsonVoiceCachedDevice[];
  defaultDeviceId: string | null;
  updatedAt: string;
}

export function resolveHudsonVoiceInputDevicesPath(env: NodeJS.ProcessEnv = process.env): string {
  return env[HUDSON_VOICE_INPUT_DEVICES_PATH_ENV] || HUDSON_VOICE_INPUT_DEVICES_DEFAULT_PATH;
}

export function readHudsonVoiceInputDeviceCache(
  env: NodeJS.ProcessEnv = process.env,
): HudsonVoiceInputDeviceCache | null {
  const filePath = resolveHudsonVoiceInputDevicesPath(env);
  if (!existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return normalizeHudsonVoiceInputDeviceCache(parsed);
  } catch {
    return null;
  }
}

export function writeHudsonVoiceInputDeviceCache(
  cache: Omit<HudsonVoiceInputDeviceCache, 'schemaVersion' | 'updatedAt'>,
  env: NodeJS.ProcessEnv = process.env,
): HudsonVoiceInputDeviceCache {
  const normalized = normalizeHudsonVoiceInputDeviceCache({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    ...cache,
  });
  const filePath = resolveHudsonVoiceInputDevicesPath(env);
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    chmodSync(dirname(filePath), 0o700);
  } catch {
    // Best-effort on platforms that do not support POSIX modes.
  }
  writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort on platforms that do not support POSIX modes.
  }
  return normalized;
}

export function normalizeHudsonVoiceInputDeviceCache(value: unknown): HudsonVoiceInputDeviceCache {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const devices = Array.isArray(raw.devices)
    ? raw.devices
      .map(item => normalizeCachedDevice(item))
      .filter((item): item is HudsonVoiceCachedDevice => item !== null)
    : [];

  return {
    schemaVersion: typeof raw.schemaVersion === 'number' && raw.schemaVersion > 0 ? raw.schemaVersion : 1,
    devices,
    defaultDeviceId: cleanString(raw.defaultDeviceId),
    updatedAt: cleanString(raw.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeCachedDevice(value: unknown): HudsonVoiceCachedDevice | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = cleanString(raw.id);
  const name = cleanString(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    isDefault: raw.isDefault === true,
    isSelected: raw.isSelected === true,
  };
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildHudsonVoiceDeviceList(
  selectedDeviceId: string | null,
  env: NodeJS.ProcessEnv = process.env,
) {
  const cache = readHudsonVoiceInputDeviceCache(env);
  if (cache?.devices.length) {
    return {
      devices: cache.devices.map(device => ({
        ...device,
        isSelected: selectedDeviceId ? device.id === selectedDeviceId : false,
      })),
      defaultDeviceId: cache.defaultDeviceId,
      source: 'native-cache' as const,
    };
  }

  if (!selectedDeviceId) {
    return {
      devices: [] as HudsonVoiceCachedDevice[],
      defaultDeviceId: null,
      source: 'hudson-preferences' as const,
    };
  }

  return {
    devices: [{
      id: selectedDeviceId,
      name: 'Selected Hudson Voice input',
      isSelected: true,
      isDefault: false,
    }],
    defaultDeviceId: null,
    source: 'hudson-preferences' as const,
  };
}
