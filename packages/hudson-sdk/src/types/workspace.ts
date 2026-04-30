import type { HudsonApp } from './app';

// ---------------------------------------------------------------------------
// Canvas participation — how an app renders inside a multi-app workspace
// ---------------------------------------------------------------------------
export type CanvasParticipation = 'native' | 'windowed';

// ---------------------------------------------------------------------------
// WorkspaceAppConfig — one app's configuration within a workspace (authoring seed)
// ---------------------------------------------------------------------------
export interface WorkspaceAppConfig {
  app: HudsonApp;
  /** How the app participates in canvas mode (default: 'native') */
  canvasMode?: CanvasParticipation;
  /** Default window bounds for 'windowed' apps */
  defaultWindowBounds?: { x: number; y: number; w: number; h: number };
}

// ---------------------------------------------------------------------------
// AppInstance — one live window at runtime.
// A workspace's `apps: WorkspaceAppConfig[]` is the authoring seed; once the
// shell is running, a separate `instances: AppInstance[]` list is authoritative
// and can grow (via spawn/duplicate) or shrink (via close).
// ---------------------------------------------------------------------------
export interface AppInstance {
  /** Unique across a workspace. Doubles as the localStorage scope key. */
  instanceId: string;
  /** References the HudsonApp this is an instance of. */
  appId: string;
  /** Optional user-overridable title; when omitted the shell derives one. */
  title?: string;
  /** Persisted window bounds snapshot (authoring seed copies this from
   *  defaultWindowBounds; runtime spawns derive from the canvas centre). */
  bounds?: { x: number; y: number; w: number; h: number };
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
  /** Initial canvas zoom when the workspace first boots. Defaults to 1 (100%). */
  defaultScale?: number;
  /** Render the left app navigation panel while the workspace is in canvas mode. */
  showLeftNavigation?: boolean;
}
