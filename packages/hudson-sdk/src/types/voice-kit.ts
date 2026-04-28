// ---------------------------------------------------------------------------
// AssistantVoiceKit — the interface between Assistant and voice functionality.
// This is a types-only file with no runtime voice imports.
// The implementation lives in @hudsonos/sdk/voice (useAssistantVoice hook).
// ---------------------------------------------------------------------------

import type { UIMessage } from 'ai';

export type VoiceKitStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'ready'
  | 'synthesizing'
  | 'speaking'
  | 'unavailable'
  | 'error';

export interface VoiceKitInput {
  status: VoiceKitStatus;
  error: string | null;
  isSupported: boolean;
  start: (onTranscript: (transcript: string) => void) => Promise<void>;
  stop: () => void;
}

export interface VoiceKitOutput {
  status: VoiceKitStatus;
  error: string | null;
  isPlaying: boolean;
  speak: (text: string, opts?: Record<string, unknown>) => Promise<void>;
  stop: () => void;
}

export interface VoiceKitSettings {
  autoSend: boolean;
  speakReplies: boolean;
}

export interface AssistantVoiceKit {
  input: VoiceKitInput;
  output: VoiceKitOutput;
  settings: VoiceKitSettings;
  /** Shape a message into spoken text and play it. */
  speakReply: (message: Pick<UIMessage, 'parts'>, metadata?: Record<string, unknown>) => void;
}
