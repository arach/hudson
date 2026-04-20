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

import type { HudsonApp, HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from '@hudson/sdk';

// --- Core apps (always loaded) ------------------------------------------------

import { hudsonDocsApp } from './hudson-docs';
import { hudsonAIApp } from './hudson-ai';
import { intentExplorerApp } from './intent-explorer';
import { logoDesignerApp } from './logo-designer';
import { shaperApp } from './shaper';
import { traceViewerApp } from './trace-viewer';
// Terminal is available in the bottom console panel (AI + Terminal tabs)
// import { terminalApp } from './terminal';
import { openscoutApp } from './openscout';
import { assetsApp } from './assets';
import { apiInspectorApp } from './api-inspector';
import { jsonExplorerApp } from './json-explorer';
import { notepadApp } from './notepad';

// --- App lookup table (id → app) for data-driven workspace resolution --------

function getAppById(id: string): HudsonApp | null {
  const table: Record<string, HudsonApp> = {
    'hudson-docs': hudsonDocsApp,
    'hudson-ai': hudsonAIApp,
    'intent-explorer': intentExplorerApp,
    'logo-designer': logoDesignerApp,
    'shaper': shaperApp,
    'trace-viewer': traceViewerApp,
    'openscout': openscoutApp,
    'assets': assetsApp,
    'api-inspector': apiInspectorApp,
    'json-explorer': jsonExplorerApp,
    'notepad': notepadApp,
  };
  if (table[id]) return table[id];
  // Also search local apps (e.g., hero, external repos)
  const local = localApps.find(c => c.app.id === id);
  return local?.app ?? null;
}

// --- Data-driven workspaces (loaded from JSON) --------------------------------

interface WorkspaceJson {
  id: string;
  name: string;
  description?: string;
  mode?: 'canvas' | 'panel';
  defaultFocusedAppId?: string;
  apps: {
    appId: string;
    canvasMode?: CanvasParticipation;
    defaultWindowBounds?: { x: number; y: number; w: number; h: number };
  }[];
}

function loadWorkspacesFromJson(): HudsonWorkspace[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: WorkspaceJson[] = require('../local/workspaces.json');
    return data
      .map(ws => {
        const apps: WorkspaceAppConfig[] = ws.apps
          .map(entry => {
            const app = getAppById(entry.appId);
            if (!app) {
              console.warn(`[registry] workspace "${ws.id}": unknown app "${entry.appId}", skipping`);
              return null;
            }
            return {
              app,
              canvasMode: entry.canvasMode,
              defaultWindowBounds: entry.defaultWindowBounds,
            } as WorkspaceAppConfig;
          })
          .filter((c): c is WorkspaceAppConfig => c !== null);

        if (apps.length === 0) return null;

        return {
          id: ws.id,
          name: ws.name,
          description: ws.description ?? '',
          mode: ws.mode ?? 'canvas',
          apps,
          defaultFocusedAppId: ws.defaultFocusedAppId,
        } as HudsonWorkspace;
      })
      .filter((ws): ws is HudsonWorkspace => ws !== null);
  } catch {
    // No workspaces.json or parse error — that's fine
    return [];
  }
}

function getCoreApps(): WorkspaceAppConfig[] {
  return [
    {
      app: hudsonDocsApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -520, y: -280, w: 900, h: 650 },
    },
    {
      app: hudsonAIApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 420, y: -280, w: 760, h: 580 },
    },
    {
      app: apiInspectorApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -420, y: 420, w: 760, h: 560 },
    },
    {
      app: jsonExplorerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 420, y: 380, w: 620, h: 500 },
    },
  ];
}

function getScoutOpsApps(): WorkspaceAppConfig[] {
  return [
    {
      app: openscoutApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -760, y: -260, w: 1040, h: 760 },
    },
    {
      app: hudsonAIApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 380, y: -260, w: 720, h: 560 },
    },
    {
      app: traceViewerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -760, y: 560, w: 520, h: 360 },
    },
    {
      app: apiInspectorApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -180, y: 420, w: 720, h: 460 },
    },
    {
      app: jsonExplorerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 600, y: 360, w: 560, h: 440 },
    },
  ];
}

// --- Local apps (developer-specific, gitignored) ------------------------------

import { localApps, localWorkspaces } from '../local/apps.local';

// --- Exports ------------------------------------------------------------------

/** The main Hudson OS workspace — intentionally minimal for demos and daily use. */
export function getHudsonOSWorkspace(): HudsonWorkspace {
  return {
    id: 'hudson-os',
    name: 'Hudson OS',
    description: 'Clean docs, AI, and API workspace',
    mode: 'canvas',
    apps: getCoreApps(),
    defaultFocusedAppId: 'hudson-docs',
    defaultScale: 0.5,
  };
}

/** Scout Ops — Hudson workspace centered on the OpenScout operator surface. */
export function getScoutOpsWorkspace(): HudsonWorkspace {
  return {
    id: 'scout-ops',
    name: 'Scout Ops',
    description: 'OpenScout-driven workspace for agent traffic, AI assistance, and debugging',
    mode: 'canvas',
    apps: getScoutOpsApps(),
    defaultFocusedAppId: 'openscout',
    defaultScale: 0.2,
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

/** All workspaces available to WorkspaceShell — hudsonOS + JSON-defined + local code workspaces. */
export function getAllWorkspaces(): HudsonWorkspace[] {
  return [getHudsonOSWorkspace(), getScoutOpsWorkspace(), ...loadWorkspacesFromJson(), ...localWorkspaces];
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
