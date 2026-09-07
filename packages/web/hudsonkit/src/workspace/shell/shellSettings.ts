'use client';

import type { HudsonSettings } from '../settings/types';

export const DEFAULT_SHELL_SETTINGS: HudsonSettings = {
  theme: 'system',
  template: 'hudson',
  contextMenuMode: 'hudson-first',
  glowIntensity: 30,
  gridOpacity: 60,
  connectorStyle: 'dashed',
  zoomSensitivity: 1.0,
  masterMute: false,
  uiClickSounds: true,
  uiTransitionSounds: true,
  aiMode: 'cli',
  font: { fontSize: 13, fontFamily: 'system-ui' },
  voice: {
    autoSend: true,
    speakReplies: false,
    replyProvider: 'vox',
    replyModel: 'avspeech:system',
    replyVoice: '',
    replyRate: 1,
    spokenReplyStyle: 'adaptive',
    spokenReplyLongResponse: 'invite',
    spokenReplyCodeResponse: 'summary',
    spokenReplyMaxChars: 720,
  },
};

export function normalizeHudsonSettings(
  settings: Partial<HudsonSettings> | null | undefined,
): HudsonSettings {
  return {
    ...DEFAULT_SHELL_SETTINGS,
    ...settings,
    font: {
      ...DEFAULT_SHELL_SETTINGS.font,
      ...(settings?.font ?? {}),
    },
    voice: {
      ...DEFAULT_SHELL_SETTINGS.voice,
      ...(settings?.voice ?? {}),
      replyProvider: 'vox',
      replyModel: !settings?.voice?.replyModel || settings.voice.replyModel === 'system'
        ? 'avspeech:system'
        : settings.voice.replyModel,
    },
  };
}

export function mergeHudsonSettings(
  settings: Partial<HudsonSettings> | null | undefined,
  patch: Partial<HudsonSettings>,
): HudsonSettings {
  const current = normalizeHudsonSettings(settings);

  return normalizeHudsonSettings({
    ...current,
    ...patch,
    font: patch.font ? { ...current.font, ...patch.font } : current.font,
    voice: patch.voice ? { ...current.voice, ...patch.voice } : current.voice,
  });
}
