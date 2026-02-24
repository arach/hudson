import type { HudsonApp } from './app';

// ---------------------------------------------------------------------------
// Canvas participation — how an app renders inside a multi-app workspace
// ---------------------------------------------------------------------------
export type CanvasParticipation = 'native' | 'windowed';

// ---------------------------------------------------------------------------
// WorkspaceAppConfig — one app's configuration within a workspace
// ---------------------------------------------------------------------------
export interface WorkspaceAppConfig {
  app: HudsonApp;
  /** How the app participates in canvas mode (default: 'native') */
  canvasMode?: CanvasParticipation;
  /** Default window bounds for 'windowed' apps */
  defaultWindowBounds?: { x: number; y: number; w: number; h: number };
}

// ---------------------------------------------------------------------------
// HudsonWorkspace — a collection of apps that coexist in a shared shell
// ---------------------------------------------------------------------------
export interface HudsonWorkspace {
  id: string;
  name: string;
  description?: string;
  /** Frame mode: 'canvas' for pan/zoom world, 'panel' for scrollable layout */
  mode: 'canvas' | 'panel';
  /** Apps participating in this workspace */
  apps: WorkspaceAppConfig[];
  /** Which app receives focus by default */
  defaultFocusedAppId?: string;
}
