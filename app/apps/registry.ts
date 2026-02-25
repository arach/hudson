// ─────────────────────────────────────────────────────────────────────────────
// App Registry
// ─────────────────────────────────────────────────────────────────────────────
//
// This file is the single source of truth for which apps and workspaces
// are loaded at runtime. It merges two layers:
//
//   CORE APPS (tracked in git, always available)
//     hudson-docs, intent-explorer — live in app/apps/
//
//   LOCAL APPS (gitignored, opt-in per developer)
//     Defined in app/local/apps.local.ts — auto-created as an empty stub
//     on first `bun dev` if it doesn't exist (see next.config.ts).
//
// To add apps locally without touching tracked files, edit apps.local.ts.
// See app/catalog/apps.local.example.ts for a full working template.
// ─────────────────────────────────────────────────────────────────────────────

import type { HudsonWorkspace, WorkspaceAppConfig } from '@hudson/sdk';

// --- Core apps (always loaded) ------------------------------------------------

import { hudsonDocsApp } from './hudson-docs';
import { intentExplorerApp } from './intent-explorer';

const coreApps: WorkspaceAppConfig[] = [
  { app: hudsonDocsApp, canvasMode: 'native' },
  {
    app: intentExplorerApp,
    canvasMode: 'windowed',
    defaultWindowBounds: { x: 200, y: -200, w: 680, h: 500 },
  },
];

// --- Local apps (developer-specific, gitignored) ------------------------------

import { localApps, localWorkspaces } from '../local/apps.local';

// --- Exports ------------------------------------------------------------------

/** The main Hudson OS workspace — core apps + any locally registered apps. */
export const hudsonOSWorkspace: HudsonWorkspace = {
  id: 'hudson-os',
  name: 'Hudson OS',
  description: 'Multi-app canvas workspace',
  mode: 'canvas',
  apps: [...coreApps, ...localApps],
  defaultFocusedAppId: 'hudson-docs',
};

/** All workspaces available to WorkspaceShell — hudsonOS + any local workspaces. */
export const allWorkspaces: HudsonWorkspace[] = [
  hudsonOSWorkspace,
  ...localWorkspaces,
];
