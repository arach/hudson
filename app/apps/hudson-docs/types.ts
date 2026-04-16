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

export interface FontSettings {
  fontSize: number;
  fontFamily: string;
}

export interface VoiceSettings {
  autoSend: boolean;
  speakReplies: boolean;
  replyVoice: string;
  replyRate: number;
  spokenReplyStyle: 'brief' | 'full';
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
