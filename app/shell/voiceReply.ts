// Re-export voice helpers from hudsonkit/voice so existing app imports keep working.
// The actual implementation lives in packages/web/hudsonkit/src/lib/voiceReply.ts.
export {
  applyHudsonVoiceBehaviorPreset,
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
  getHudsonSpokenReplyStyleLabel,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
} from 'hudsonkit/voice';
export type { HudsonSpokenReplyStyle, HudsonVoiceBehaviorPreset } from 'hudsonkit/voice';
