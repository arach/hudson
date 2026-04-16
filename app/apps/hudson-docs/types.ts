import type { LucideIcon } from 'lucide-react';

export type ViewMode = 'canvas' | 'list' | 'tiles';

export interface ComponentEntry {
  id: string;
  /** Dot-separated namespace */
  ns: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  overview: string;
  props: { name: string; type: string; desc: string }[];
  usage: string;
  notes?: string[];
  position: { x: number; y: number };
}

export interface AgentDocEntry {
  slug: string;
  title: string;
  description: string;
  file: string;
  position: { x: number; y: number };
}

export type AIMode = 'cli' | 'api';
export type SpokenReplyStyle = 'brief' | 'full' | 'adaptive';
export type SpokenReplyLongResponse = 'summary' | 'invite' | 'verbatim';
export type SpokenReplyCodeResponse = 'summary' | 'mention' | 'read';

export interface FontSettings {
  fontSize: number;
  fontFamily: string;
}

export interface VoiceSettings {
  autoSend: boolean;
  speakReplies: boolean;
  replyProvider: 'system' | 'openai' | 'elevenlabs' | 'groq';
  replyModel: string;
  replyVoice: string;
  replyRate: number;
  spokenReplyStyle: SpokenReplyStyle;
  spokenReplyLongResponse: SpokenReplyLongResponse;
  spokenReplyCodeResponse: SpokenReplyCodeResponse;
  spokenReplyMaxChars: number;
}

export interface HudsonSettings {
  glowIntensity: number;
  gridOpacity: number;
  connectorStyle: 'dashed' | 'solid' | 'dotted';
  zoomSensitivity: number;
  masterMute: boolean;
  uiClickSounds: boolean;
  uiTransitionSounds: boolean;
  aiMode: AIMode;
  font: FontSettings;
  voice: VoiceSettings;
}
