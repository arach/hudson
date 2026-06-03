// hudsonkit/voice — opt-in voice plugin.
// Import from 'hudsonkit/voice' only if you want voice functionality.
// This entry point pulls in voice hooks, the Hudson voice service client, and
// voice reply shaping. Direct Vox access stays behind dynamic/explicit adapters.

// Hooks
export { useVoiceInput } from './hooks/useVoiceInput';
export type { UseVoiceInputOptions, UseVoiceInputResult } from './hooks/useVoiceInput';
export { useHudsonVoiceInput } from './hooks/useHudsonVoiceInput';
export type { UseHudsonVoiceInputOptions, UseHudsonVoiceInputResult } from './hooks/useHudsonVoiceInput';
export { useVoiceOutput } from './hooks/useVoiceOutput';
export type { UseVoiceOutputResult, SpeakOptions } from './hooks/useVoiceOutput';

// Voice types
export type {
  VoiceSettings,
  VoiceStatus,
  VoiceProvider,
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
} from './types/voice';
export { DEFAULT_VOICE_SETTINGS } from './types/voice';

// Reply shaping
export {
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
  getHudsonSpokenReplyStyleLabel,
  applyHudsonVoiceBehaviorPreset,
} from './lib/voiceReply';
export type { HudsonSpokenReplyStyle, HudsonVoiceBehaviorPreset } from './lib/voiceReply';

// Voice kit type (re-export for convenience)
export type { AssistantVoiceKit, VoiceKitInput, VoiceKitOutput, VoiceKitSettings } from './types/voice-kit';

// Voice kit hook — the main integration point
export { useAssistantVoice } from './hooks/useAssistantVoice';
export type { UseAssistantVoiceOptions } from './hooks/useAssistantVoice';

// Hudson-owned local voice service client
export {
  HUDSON_VOICE_DAEMON_DEFAULT_HOST,
  HUDSON_VOICE_DAEMON_DEFAULT_PORT,
  HUDSON_VOICE_DAEMON_DEFAULT_WS_URL,
  HudsonVoiceClientError,
  createHudsonVoiceDaemonClient,
  createHudsonVoiceClient,
  parseHudsonVoiceEventLine,
  parseHudsonVoiceEventStream,
  parseHudsonVoiceNdjson,
  probeHudsonVoiceAvailability,
} from './lib/hudsonVoiceClient';
export type {
  HudsonVoiceAvailability,
  HudsonVoiceClient,
  HudsonVoiceClientErrorCode,
  HudsonVoiceClientOptions,
  HudsonVoiceDaemonStatus,
  HudsonVoiceDaemonClientOptions,
  HudsonVoiceDevice,
  HudsonVoiceDeviceList,
  HudsonVoiceFetch,
  HudsonVoiceHealth,
  HudsonVoiceInputState,
  HudsonVoiceLiveEvent,
  HudsonVoiceLiveSession,
  HudsonVoiceLiveSessionRequest,
  HudsonVoiceMode,
  HudsonVoiceProbeClient,
  HudsonVoicePermissionStatus,
  HudsonVoiceRuntimeHealth,
} from './lib/hudsonVoiceClient';
