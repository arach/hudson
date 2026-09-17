import { createElement } from 'react';
import { AudioLines } from 'hudsonkit/icons';
import type { HudsonApp, AppManifest } from 'hudsonkit';
import { VoiceProvider } from './VoiceProvider';
import { VoiceContent } from './VoiceContent';
import { hudsonVoiceSettings } from './settings';
import { useVoiceCommands, useVoiceStatus, useVoiceLayoutMode } from './hooks';

const hudsonVoiceManifest: AppManifest = {
  id: 'hudson-voice',
  name: 'Voice',
  description: 'Live voice conversation surface — microphone in, spoken replies and tool activity out',
  mode: 'panel',
};

export const hudsonVoiceApp: HudsonApp = {
  id: 'hudson-voice',
  name: 'Voice',
  description: 'Live voice conversation with microphone control, transcript, and tool activity',
  agentContext:
    'Voice hosts a live speech conversation session. The provider, model, voice, and ' +
    'credentials are server-owned and read from the server environment; the browser never ' +
    'holds secrets. Users pick a microphone (switchable mid-session), connect, and speak; ' +
    'microphone mute is independent from interrupting assistant playback, and interrupting ' +
    'never cancels running tools. Sessions auto-end at the server-declared limit.',
  mode: 'panel',
  icon: createElement(AudioLines, { size: 12 }),
  manifest: hudsonVoiceManifest,
  settings: hudsonVoiceSettings,

  Provider: VoiceProvider,

  slots: {
    Content: VoiceContent,
  },

  hooks: {
    useCommands: useVoiceCommands,
    useStatus: useVoiceStatus,
    useLayoutMode: useVoiceLayoutMode,
  },
};
