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

// Compatibility only: the Phase 2 guardrail keeps app/shell/WorkspaceShell.tsx
// unchanged until the host graduates in a later phase. The source type now
// lives in hudsonkit/settings.
export type { HudsonSettings } from 'hudsonkit/settings';
