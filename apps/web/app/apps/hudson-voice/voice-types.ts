import type { ConversationConfig } from '@hudsonkit/ai/conversation';

export type VoicePhase = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';
export interface VoiceTranscript { id: number; role: 'user' | 'assistant'; text: string }
export interface VoiceToolActivity { id: string; name: string; status: 'running' | 'complete' | 'failed' | 'cancelled'; detail: string }
export interface VoiceDevice { id: string; label: string }
export interface VoiceAvailability {
  ready: boolean;
  message: string;
  config?: ConversationConfig;
  sessionLimitSeconds: number;
}
export interface VoiceState {
  phase: VoicePhase;
  availability: VoiceAvailability;
  loading: boolean;
  message: string;
  devices: VoiceDevice[];
  selectedDeviceId: string;
  actualMicrophone: string;
  selectingMicrophone: boolean;
  microphoneMuted: boolean;
  playbackMuted: boolean;
  playbackBlocked: boolean;
  elapsedSeconds: number;
  transcript: VoiceTranscript[];
  tools: VoiceToolActivity[];
}
export interface VoiceActions {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refreshAvailability(): Promise<void>;
  refreshMicrophones(): Promise<void>;
  selectMicrophone(id: string): Promise<void>;
  toggleMicrophone(): void;
  interrupt(): void;
  resumePlayback(): Promise<void>;
  clearTranscript(): void;
}
export type VoiceContextValue = VoiceState & VoiceActions;
