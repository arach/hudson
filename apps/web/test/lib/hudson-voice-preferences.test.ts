import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV,
  HUDSON_VOICE_PREFERENCES_PATH_ENV,
  readHudsonVoicePreferences,
  writeHudsonVoicePreferences,
} from '@/app/lib/hudsonVoicePreferences';
import { GET as getDevices } from '@/app/api/hudson-voice/v1/voice/devices/route';
import { PUT as putDefaultDevice } from '@/app/api/hudson-voice/v1/voice/devices/default/route';
import { GET as getSettings, PUT as putSettings } from '@/app/api/hudson-voice/v1/voice/settings/route';

const tempDirs: string[] = [];
const originalPreferencesPath = process.env[HUDSON_VOICE_PREFERENCES_PATH_ENV];
const originalMirrorPath = process.env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV];

afterEach(() => {
  if (originalPreferencesPath === undefined) delete process.env[HUDSON_VOICE_PREFERENCES_PATH_ENV];
  else process.env[HUDSON_VOICE_PREFERENCES_PATH_ENV] = originalPreferencesPath;
  if (originalMirrorPath === undefined) delete process.env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV];
  else process.env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV] = originalMirrorPath;

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function useTempPreferences() {
  const dir = mkdtempSync(join(tmpdir(), 'hudson-voice-preferences-'));
  tempDirs.push(dir);
  process.env[HUDSON_VOICE_PREFERENCES_PATH_ENV] = join(dir, 'Voice', 'preferences.json');
  process.env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV] = join(dir, 'Vox', 'preferences.json');
  return {
    preferencesPath: process.env[HUDSON_VOICE_PREFERENCES_PATH_ENV]!,
    mirrorPath: process.env[HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH_ENV]!,
  };
}

function sameOriginRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost:3500${path}`, {
    ...init,
    headers: {
      origin: 'http://localhost:3500',
      'sec-fetch-site': 'same-origin',
      ...(init.headers ?? {}),
    },
  });
}

describe('Hudson voice preferences', () => {
  it('persists Hudson-owned preferences and mirrors embedded runtime preferences', () => {
    const { preferencesPath, mirrorPath } = useTempPreferences();

    const preferences = writeHudsonVoicePreferences({
      preferredInputDeviceId: 'mic-1',
      preferredTranscriptionModelId: 'parakeet:v3',
      preferredLanguage: 'en',
    });

    expect(preferences.preferredInputDeviceId).toBe('mic-1');
    expect(readHudsonVoicePreferences().preferredInputDeviceId).toBe('mic-1');
    expect(existsSync(preferencesPath)).toBe(true);
    expect(JSON.parse(readFileSync(mirrorPath, 'utf8'))).toMatchObject({
      speech: {
        preferredInputDeviceId: 'mic-1',
        preferredTranscriptionModelId: 'parakeet:v3',
      },
    });
  });

  it('device routes read and update preferred input device without requiring a runtime', async () => {
    useTempPreferences();

    const putResponse = await putDefaultDevice(sameOriginRequest('/api/hudson-voice/v1/voice/devices/default', {
      method: 'PUT',
      body: JSON.stringify({ deviceId: 'mic-route' }),
    }));
    await expect(putResponse.json()).resolves.toMatchObject({
      selectedDeviceId: 'mic-route',
      settings: { preferredInputDeviceId: 'mic-route' },
    });

    const getResponse = await getDevices(sameOriginRequest('/api/hudson-voice/v1/voice/devices'));
    await expect(getResponse.json()).resolves.toMatchObject({
      selectedDeviceId: 'mic-route',
      devices: [{ id: 'mic-route', isSelected: true }],
    });
  });

  it('settings route updates model, language, mode, and input preference', async () => {
    useTempPreferences();

    const response = await putSettings(sameOriginRequest('/api/hudson-voice/v1/voice/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          inputDeviceId: 'mic-settings',
          modelId: 'parakeet:v3',
          language: 'en',
          mode: 'always_on',
        },
      }),
    }));

    await expect(response.json()).resolves.toMatchObject({
      settings: {
        preferredInputDeviceId: 'mic-settings',
        preferredTranscriptionModelId: 'parakeet:v3',
        preferredLanguage: 'en',
        mode: 'always_on',
      },
    });

    const getResponse = await getSettings(sameOriginRequest('/api/hudson-voice/v1/voice/settings'));
    await expect(getResponse.json()).resolves.toMatchObject({
      settings: {
        preferredInputDeviceId: 'mic-settings',
        mode: 'always_on',
      },
    });
  });

  it('settings route rejects invalid capture mode', async () => {
    useTempPreferences();

    const response = await putSettings(sameOriginRequest('/api/hudson-voice/v1/voice/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { mode: 'hands_free' } }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid Hudson voice mode'),
    });
  });
});
