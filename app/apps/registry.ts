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
//
// App references are read inside getter functions (not at module scope) to
// avoid circular-init TDZ errors in Vite ESM where intent-explorer →
// IntentProvider → registry → intent-explorer forms a cycle.
// ─────────────────────────────────────────────────────────────────────────────

import type { HudsonWorkspace, WorkspaceAppConfig } from '@hudson/sdk';

// --- Core apps (always loaded) ------------------------------------------------

import { hudsonDocsApp } from './hudson-docs';
import { intentExplorerApp } from './intent-explorer';
import { logoDesignerApp } from './logo-designer';
import { shaperApp } from './shaper';

function getCoreApps(): WorkspaceAppConfig[] {
  return [
    { app: hudsonDocsApp, canvasMode: 'native' },
    {
      app: intentExplorerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 200, y: -200, w: 680, h: 500 },
    },
    {
      app: logoDesignerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 100, y: -200, w: 900, h: 700 },
    },
    {
      app: shaperApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -400, y: -300, w: 800, h: 600 },
    },
  ];
}

// --- Local apps (developer-specific, gitignored) ------------------------------

import { localApps, localWorkspaces } from '../local/apps.local';

// --- Exports ------------------------------------------------------------------

/** The main Hudson OS workspace — core apps + any locally registered apps. */
export function getHudsonOSWorkspace(): HudsonWorkspace {
  return {
    id: 'hudson-os',
    name: 'Hudson OS',
    description: 'Multi-app canvas workspace',
    mode: 'canvas',
    apps: [...getCoreApps(), ...localApps],
    defaultFocusedAppId: 'hudson-docs',
  };
}

// Backwards-compat: callers that import `hudsonOSWorkspace` as a const get
// a cached snapshot created on first access.
let _ws: HudsonWorkspace | undefined;
export const hudsonOSWorkspace = new Proxy({} as HudsonWorkspace, {
  get(_, prop, receiver) {
    _ws ??= getHudsonOSWorkspace();
    return Reflect.get(_ws, prop, receiver);
  },
  ownKeys() {
    _ws ??= getHudsonOSWorkspace();
    return Reflect.ownKeys(_ws);
  },
  getOwnPropertyDescriptor(_, prop) {
    _ws ??= getHudsonOSWorkspace();
    return Object.getOwnPropertyDescriptor(_ws, prop);
  },
});

/** All workspaces available to WorkspaceShell — hudsonOS + any local workspaces. */
export function getAllWorkspaces(): HudsonWorkspace[] {
  return [getHudsonOSWorkspace(), ...localWorkspaces];
}

let _all: HudsonWorkspace[] | undefined;
export const allWorkspaces = new Proxy([] as HudsonWorkspace[], {
  get(_, prop, receiver) {
    _all ??= getAllWorkspaces();
    const val = Reflect.get(_all, prop, receiver);
    return typeof val === 'function' ? val.bind(_all) : val;
  },
  ownKeys() {
    _all ??= getAllWorkspaces();
    return Reflect.ownKeys(_all);
  },
  getOwnPropertyDescriptor(_, prop) {
    _all ??= getAllWorkspaces();
    return Object.getOwnPropertyDescriptor(_all, prop);
  },
});
