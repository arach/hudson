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

import type { VoiceSettings as SdkVoiceSettings } from 'hudsonkit/voice';

export type AIMode = 'cli' | 'api';

// Voice types live in hudsonkit/voice so the SDK Assistant + app consumers
// share a single source of truth. Re-exported here for backwards compat with
// the many existing imports in app/shell.
export type {
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
  VoiceSettings,
} from 'hudsonkit/voice';

export interface FontSettings {
  fontSize: number;
  fontFamily: string;
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
  voice: SdkVoiceSettings;
}
