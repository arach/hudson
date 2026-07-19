import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const HUDSON_VOICE_PREFERENCES_PATH_ENV = 'HUDSON_VOICE_PREFERENCES_PATH';
export const HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV = 'HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH';
export const HUDSON_VOICE_PREFERENCES_DEFAULT_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Hudson',
  'Voice',
  'preferences.json',
);
export const HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_DEFAULT_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Hudson',
  'Vox',
  'preferences.json',
);
export const HUDSON_VOICE_DEFAULT_TRANSCRIPTION_MODEL = 'parakeet:v3';
export const HUDSON_VOICE_DEFAULT_LANGUAGE = 'en';
export const HUDSON_VOICE_DEFAULT_MODE = 'push_to_talk';
export const HUDSON_VOICE_MODES = ['push_to_talk', 'always_on'] as const;
export type HudsonVoiceMode = typeof HUDSON_VOICE_MODES[number];

export interface HudsonVoicePreferences {
  schemaVersion: number;
  preferredInputDeviceId: string | null;
  preferredOutputDeviceId: string | null;
  preferredTranscriptionModelId: string | null;
  preferredSynthesisModelId: string | null;
  preferredLanguage: string | null;
  mode: HudsonVoiceMode;
}

export function defaultHudsonVoicePreferences(): HudsonVoicePreferences {
  return {
    schemaVersion: 1,
    preferredInputDeviceId: null,
    preferredOutputDeviceId: null,
    preferredTranscriptionModelId: HUDSON_VOICE_DEFAULT_TRANSCRIPTION_MODEL,
    preferredSynthesisModelId: null,
    preferredLanguage: HUDSON_VOICE_DEFAULT_LANGUAGE,
    mode: HUDSON_VOICE_DEFAULT_MODE,
  };
}

export function resolveHudsonVoicePreferencesPath(env: NodeJS.ProcessEnv = process.env): string {
  return env[HUDSON_VOICE_PREFERENCES_PATH_ENV] || HUDSON_VOICE_PREFERENCES_DEFAULT_PATH;
}

export function resolveHudsonVoiceEmbeddedVoxPreferencesPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV]
    || HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_DEFAULT_PATH;
}

export function readHudsonVoicePreferences(env: NodeJS.ProcessEnv = process.env): HudsonVoicePreferences {
  const filePath = resolveHudsonVoicePreferencesPath(env);
  if (!existsSync(filePath)) return defaultHudsonVoicePreferences();
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return normalizeHudsonVoicePreferences(parsed);
}

export function writeHudsonVoicePreferences(
  next: Partial<HudsonVoicePreferences>,
  options: {
    env?: NodeJS.ProcessEnv;
    mirrorEmbeddedVoxPath?: string | false;
  } = {},
): HudsonVoicePreferences {
  const current = readHudsonVoicePreferences(options.env);
  const patch = Object.fromEntries(
    Object.entries(next).filter(([, value]) => value !== undefined),
  );
  const preferences = normalizeHudsonVoicePreferences({
    ...current,
    ...patch,
  });
  const filePath = resolveHudsonVoicePreferencesPath(options.env);
  writePrivateJson(filePath, preferences);

  const mirrorPath = options.mirrorEmbeddedVoxPath === false
    ? null
    : options.mirrorEmbeddedVoxPath ?? resolveHudsonVoiceEmbeddedVoxPreferencesPath(options.env);
  if (mirrorPath) {
    writePrivateJson(mirrorPath, {
      speech: {
        preferredTranscriptionModelId: preferences.preferredTranscriptionModelId,
        preferredSynthesisModelId: preferences.preferredSynthesisModelId,
        preferredInputDeviceId: preferences.preferredInputDeviceId,
      },
    });
  }

  return preferences;
}

export function normalizeHudsonVoicePreferences(value: unknown): HudsonVoicePreferences {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' && raw.schemaVersion > 0 ? raw.schemaVersion : 1,
    preferredInputDeviceId: cleanString(raw.preferredInputDeviceId),
    preferredOutputDeviceId: cleanString(raw.preferredOutputDeviceId),
    preferredTranscriptionModelId:
      cleanString(raw.preferredTranscriptionModelId) ?? HUDSON_VOICE_DEFAULT_TRANSCRIPTION_MODEL,
    preferredSynthesisModelId: cleanString(raw.preferredSynthesisModelId),
    preferredLanguage: cleanString(raw.preferredLanguage) ?? HUDSON_VOICE_DEFAULT_LANGUAGE,
    mode: normalizeMode(raw.mode),
  };
}

function normalizeMode(value: unknown): HudsonVoiceMode {
  const cleaned = cleanString(value);
  if (cleaned === 'push_to_talk' || cleaned === 'always_on') return cleaned;
  return HUDSON_VOICE_DEFAULT_MODE;
}

export function assertHudsonVoiceMode(value: unknown): HudsonVoiceMode {
  const cleaned = cleanString(value);
  if (cleaned === 'push_to_talk' || cleaned === 'always_on') return cleaned;
  throw new Error(`Invalid Hudson voice mode: ${String(value)}`);
}

export function createHudsonVoiceSessionDefaults(
  preferences: HudsonVoicePreferences,
): Record<string, string> {
  const defaults: Record<string, string> = {};
  if (preferences.preferredInputDeviceId) defaults.deviceId = preferences.preferredInputDeviceId;
  if (preferences.preferredTranscriptionModelId) defaults.modelId = preferences.preferredTranscriptionModelId;
  if (preferences.preferredLanguage) defaults.language = preferences.preferredLanguage;
  if (preferences.mode) defaults.mode = preferences.mode;
  return defaults;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function writePrivateJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    chmodSync(dirname(filePath), 0o700);
  } catch {
    // Best-effort on platforms that do not support POSIX modes.
  }
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort on platforms that do not support POSIX modes.
  }
}
