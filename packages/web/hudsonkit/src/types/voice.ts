// ---------------------------------------------------------------------------
// Voice types — shared across useVoiceInput / useVoiceOutput / Assistant.
// ---------------------------------------------------------------------------

export type VoiceStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'ready'
  | 'synthesizing'
  | 'speaking'
  | 'unavailable'
  | 'error';

export type SpokenReplyStyle = 'brief' | 'full' | 'adaptive';
export type SpokenReplyLongResponse = 'summary' | 'invite' | 'verbatim';
export type SpokenReplyCodeResponse = 'summary' | 'mention' | 'read';

export type VoiceProvider = 'vox';

export interface VoiceSettings {
  /** When a transcript is captured, auto-submit it instead of just filling the input. */
  autoSend: boolean;
  /** Preferred Hudson Voice input device. Empty string means the runtime default. */
  inputDeviceId: string;
  /** Preferred Hudson Voice transcription model. Empty string means the runtime default. */
  transcriptionModel: string;
  /** Spoken language hint for capture. */
  transcriptionLanguage: string;
  /** Capture mode for Hudson Voice live sessions. */
  captureMode: 'push_to_talk' | 'always_on';
  /** Speak the assistant's replies aloud after they finish streaming. */
  speakReplies: boolean;
  replyProvider: VoiceProvider;
  replyModel: string;
  /** Voice identifier (provider-specific); empty string means "use the provider default". */
  replyVoice: string;
  /** Speech rate multiplier. 1.0 = normal. */
  replyRate: number;
  spokenReplyStyle: SpokenReplyStyle;
  spokenReplyLongResponse: SpokenReplyLongResponse;
  spokenReplyCodeResponse: SpokenReplyCodeResponse;
  spokenReplyMaxChars: number;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  autoSend: true,
  inputDeviceId: '',
  transcriptionModel: 'parakeet:v3',
  transcriptionLanguage: 'en',
  captureMode: 'push_to_talk',
  speakReplies: false,
  replyProvider: 'vox',
  replyModel: 'avspeech:system',
  replyVoice: '',
  replyRate: 1,
  spokenReplyStyle: 'adaptive',
  spokenReplyLongResponse: 'invite',
  spokenReplyCodeResponse: 'summary',
  spokenReplyMaxChars: 720,
};
