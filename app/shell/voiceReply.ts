// Re-export voice helpers from @hudson/sdk/voice so existing app imports keep working.
// The actual implementation lives in packages/hudson-sdk/src/lib/voiceReply.ts.
export {
  applyHudsonVoiceBehaviorPreset,
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
  getHudsonSpokenReplyStyleLabel,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
} from '@hudson/sdk/voice';
export type { HudsonSpokenReplyStyle, HudsonVoiceBehaviorPreset } from '@hudson/sdk/voice';
