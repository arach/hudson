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

export interface HudsonSettings {
  glowIntensity: number;
  connectorStyle: 'dashed' | 'solid' | 'dotted';
  zoomSensitivity: number;
  masterMute: boolean;
  uiClickSounds: boolean;
  uiTransitionSounds: boolean;
}
