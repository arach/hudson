import type { VoiceSettings as SdkVoiceSettings } from '../../voice';
import type { HudsonTemplate, HudsonTheme } from '../../index';

export type AIMode = 'cli' | 'api';

// Voice types live in hudsonkit/voice so the SDK Assistant and settings
// consumers share one source of truth. Re-exported for settings imports.
export type {
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
  VoiceSettings,
} from '../../voice';

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
  voice: SdkVoiceSettings;
}
