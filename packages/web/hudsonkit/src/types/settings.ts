import type { HudsonTemplate, HudsonTheme } from '../theme';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from './voice';

export type AIMode = 'cli' | 'api';

export interface FontSettings {
  fontSize: number;
  fontFamily: string;
}

export interface HudsonSettings {
  theme: HudsonTheme;
  template: HudsonTemplate;
  contextMenuMode: 'hudson-first' | 'chrome-first';
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

export const DEFAULT_SETTINGS: HudsonSettings = {
  theme: 'system',
  template: 'hudson',
  contextMenuMode: 'hudson-first',
  glowIntensity: 30,
  gridOpacity: 60,
  connectorStyle: 'dashed',
  zoomSensitivity: 1.0,
  masterMute: false,
  uiClickSounds: true,
  uiTransitionSounds: true,
  aiMode: 'cli',
  font: { fontSize: 13, fontFamily: 'system-ui' },
  voice: { ...DEFAULT_VOICE_SETTINGS },
};
