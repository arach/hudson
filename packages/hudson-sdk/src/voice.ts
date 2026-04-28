// @hudson/sdk/voice — opt-in voice plugin.
// Import from '@hudsonos/sdk/voice' only if you want voice functionality.
// This entry point pulls in @voxd/client (dynamically), useVoiceInput, useVoiceOutput,
// and voice reply shaping. The main '@hudsonos/sdk' has zero voice dependencies.

// Hooks
export { useVoiceInput } from './hooks/useVoiceInput';
export type { UseVoiceInputOptions, UseVoiceInputResult } from './hooks/useVoiceInput';
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
