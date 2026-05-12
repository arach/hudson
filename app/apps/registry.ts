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

import type { HudsonApp, HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from 'hudsonkit';
import { uniqueWorkspaces, type WorkspaceRegistryEntry } from './registry-utils';

// --- Core apps (always loaded) ------------------------------------------------

import { hudsonDocsApp } from './hudson-docs';
import { hudsonAIApp } from './hudson-ai';
import { intentExplorerApp } from './intent-explorer';
import { logoDesignerApp } from './logo-designer';
import { imageProcessLabApp } from './image-process-lab';
import { shaperApp } from './shaper';
import { traceViewerApp } from './trace-viewer';
// Terminal is available in the bottom console panel (AI + Terminal tabs)
// import { terminalApp } from './terminal';
import { openscoutApp } from './openscout';
import { assetsApp } from './assets';
import { apiInspectorApp } from './api-inspector';
import { jsonExplorerApp } from './json-explorer';
import { notepadApp } from './notepad';
import { documentLabApp } from './document-lab';
import { themeDesignerApp } from './theme-designer';
import { stageDesignApp } from './stage-design';
import { workflowLabApp } from './workflow-lab';

// --- Environment gates --------------------------------------------------------
// process.env.NODE_ENV is statically replaced by Next.js at build time. It is
// 'development' only during `bun dev`; every preview/production build (and
// `bun run build`) sets it to 'production'. Keep gitignored local workspaces out
// of production bundles even when they exist on the deploying machine.
const IS_DEV_ENV = process.env.NODE_ENV === 'development';

function getLocalRegistry(): {
  localApps: WorkspaceAppConfig[];
  localWorkspaces: HudsonWorkspace[];
} {
  if (!IS_DEV_ENV) {
    return { localApps: [], localWorkspaces: [] };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../local/apps.local');
  } catch {
    return { localApps: [], localWorkspaces: [] };
  }
}

// --- App lookup table (id → app) for data-driven workspace resolution --------

function getAppById(id: string): HudsonApp | null {
  const table: Record<string, HudsonApp> = {
    'hudson-docs': hudsonDocsApp,
    'hudson-ai': hudsonAIApp,
    'intent-explorer': intentExplorerApp,
    'logo-designer': logoDesignerApp,
    'image-process-lab': imageProcessLabApp,
    'shaper': shaperApp,
    'trace-viewer': traceViewerApp,
    'openscout': openscoutApp,
    'assets': assetsApp,
    'api-inspector': apiInspectorApp,
    'json-explorer': jsonExplorerApp,
    'notepad': notepadApp,
    'document-lab': documentLabApp,
    'theme-designer': themeDesignerApp,
    'stage-design': stageDesignApp,
    'workflow-lab': workflowLabApp,
  };
  if (table[id]) return table[id];
  // Also search local apps (e.g., hero, external repos)
  const { localApps } = getLocalRegistry();
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
  defaultActivatedAppIds?: string[];
  apps: {
    appId: string;
    canvasMode?: CanvasParticipation;
    defaultWindowBounds?: { x: number; y: number; w: number; h: number };
  }[];
}

function loadWorkspacesFromJson(): HudsonWorkspace[] {
  if (!IS_DEV_ENV) return [];

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
          defaultActivatedAppIds: ws.defaultActivatedAppIds,
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
      app: stageDesignApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 300, y: -320, w: 430, h: 560 },
    },
    {
      app: themeDesignerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 820, y: 980, w: 1040, h: 720 },
    },
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
  ];
}

function getLogoStudioApps(): WorkspaceAppConfig[] {
  return [
    {
      app: logoDesignerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -540, y: -300, w: 1080, h: 720 },
    },
    {
      app: assetsApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 580, y: -260, w: 540, h: 360 },
    },
    // Shaper bridges raster Assets → vector Logo by tracing/bezier-editing the silhouette.
    // Pipeline: assets.image → shaper.image, then shaper.svg → logo-designer.background-svg
    {
      app: shaperApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 580, y: 140, w: 540, h: 420 },
    },
    {
      app: imageProcessLabApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 580, y: 600, w: 540, h: 460 },
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

function getDeveloperModeApps(): WorkspaceAppConfig[] {
  return [
    {
      app: traceViewerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -960, y: -260, w: 660, h: 540 },
    },
    {
      app: openscoutApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -200, y: -260, w: 660, h: 540 },
    },
    {
      app: apiInspectorApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 560, y: -260, w: 760, h: 560 },
    },
    {
      app: jsonExplorerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 560, y: 360, w: 620, h: 460 },
    },
  ];
}

function getWorkflowLabApps(): WorkspaceAppConfig[] {
  return [
    {
      app: workflowLabApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 240, y: -300, w: 1040, h: 700 },
    },
    {
      app: documentLabApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 1100, y: -260, w: 720, h: 560 },
    },
  ];
}

// --- Exports ------------------------------------------------------------------

/** The main HudsonKit workspace — intentionally minimal for demos and daily use. */
export function getHudsonKitWorkspace(): HudsonWorkspace {
  return {
    id: 'hudson-os',
    name: 'Hudson Kit workspace',
    description: 'Clean docs, AI, and API workspace',
    mode: 'canvas',
    apps: getCoreApps(),
    defaultFocusedAppId: 'hudson-docs',
    defaultActivatedAppIds: ['stage-design', 'theme-designer', 'hudson-docs'],
    defaultScale: 0.45,
    defaultPan: { x: -331, y: -222 },
    leftNavigation: 'on',
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
    leftNavigation: 'minimized',
  };
}

/** Developer Mode — operational tools for traces, relay traffic, APIs, and JSON. */
export function getDeveloperModeWorkspace(): HudsonWorkspace {
  return {
    id: 'developer-mode',
    name: 'Developer Mode',
    description: 'Trace, relay, API, JSON, and architecture tools',
    mode: 'canvas',
    apps: getDeveloperModeApps(),
    defaultFocusedAppId: 'api-inspector',
    defaultScale: 0.2,
    leftNavigation: 'hidden',
  };
}

/** Logo Studio — authoring workspace for HudsonKit brand and shape work. */
export function getLogoStudioWorkspace(): HudsonWorkspace {
  return {
    id: 'logo-studio',
    name: 'Logo Studio',
    description: 'Logo design + asset export workflow',
    mode: 'canvas',
    apps: getLogoStudioApps(),
    defaultFocusedAppId: 'logo-designer',
    defaultScale: 0.5,
    leftNavigation: 'on',
  };
}

/** Document Lab — development workspace for shared text, markdown, and code surfaces. */
export function getDocumentLabWorkspace(): HudsonWorkspace {
  return {
    id: 'document-lab',
    name: 'Document Lab',
    description: 'Shared document primitive across text, markdown, and code surfaces',
    mode: 'canvas',
    apps: [{
      app: documentLabApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -460, y: -300, w: 920, h: 640 },
    }, {
      app: notepadApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 500, y: -260, w: 620, h: 560 },
    }],
    defaultFocusedAppId: 'document-lab',
    defaultScale: 0.8,
    leftNavigation: 'on',
  };
}

/** Workflow Lab — parity harness for the shared HudsonWorkflow primitive. */
export function getWorkflowLabWorkspace(): HudsonWorkspace {
  return {
    id: 'workflow-lab',
    name: 'Workflow Lab',
    description: 'Read-only web/native parity harness for HudsonWorkflow',
    mode: 'canvas',
    apps: getWorkflowLabApps(),
    defaultFocusedAppId: 'workflow-lab',
    defaultActivatedAppIds: ['workflow-lab'],
    defaultScale: 0.72,
    defaultPan: { x: -520, y: -80 },
    leftNavigation: 'on',
  };
}


// Backwards-compat: callers that import `hudsonOSWorkspace` as a const get
// a cached snapshot created on first access.
let _ws: HudsonWorkspace | undefined;
export const hudsonOSWorkspace = new Proxy({} as HudsonWorkspace, {
  get(_, prop, receiver) {
    _ws ??= getHudsonKitWorkspace();
    return Reflect.get(_ws, prop, receiver);
  },
  ownKeys() {
    _ws ??= getHudsonKitWorkspace();
    return Reflect.ownKeys(_ws);
  },
  getOwnPropertyDescriptor(_, prop) {
    _ws ??= getHudsonKitWorkspace();
    return Object.getOwnPropertyDescriptor(_ws, prop);
  },
});

/** Core public workspaces used by the hosted demo and production app. */
export function getCoreWorkspaces(): HudsonWorkspace[] {
  return uniqueWorkspaces([
    { workspace: getHudsonKitWorkspace(), source: 'core:hudsonkit' },
    { workspace: getScoutOpsWorkspace(), source: 'core:scout-ops' },
    { workspace: getDeveloperModeWorkspace(), source: 'core:developer-mode' },
    { workspace: getLogoStudioWorkspace(), source: 'core:logo-studio' },
    { workspace: getDocumentLabWorkspace(), source: 'core:document-lab' },
    { workspace: getWorkflowLabWorkspace(), source: 'core:workflow-lab' },
  ]);
}

let _core: HudsonWorkspace[] | undefined;
export const coreWorkspaces = new Proxy([] as HudsonWorkspace[], {
  get(_, prop, receiver) {
    _core ??= getCoreWorkspaces();
    const val = Reflect.get(_core, prop, receiver);
    return typeof val === 'function' ? val.bind(_core) : val;
  },
  ownKeys() {
    _core ??= getCoreWorkspaces();
    return Reflect.ownKeys(_core);
  },
  getOwnPropertyDescriptor(_, prop) {
    _core ??= getCoreWorkspaces();
    return Object.getOwnPropertyDescriptor(_core, prop);
  },
});

/** All workspaces available to WorkspaceShell — production core + dev-only local workspace sources. */
export function getAllWorkspaces(): HudsonWorkspace[] {
  const { localWorkspaces } = getLocalRegistry();
  const entries: WorkspaceRegistryEntry[] = [
    ...getCoreWorkspaces().map(workspace => ({
      workspace,
      source: `core:${workspace.id}`,
    })),
    ...(IS_DEV_ENV
      ? [
          ...loadWorkspacesFromJson().map(workspace => ({
            workspace,
            source: 'app/local/workspaces.json',
          })),
          ...localWorkspaces.map(workspace => ({
            workspace,
            source: 'app/local/apps.local.ts',
          })),
        ]
      : []),
  ];

  return uniqueWorkspaces(entries, duplicate => {
    if (IS_DEV_ENV) {
      console.warn(
        `[registry] duplicate workspace "${duplicate.id}" from ${duplicate.skippedSource}; keeping ${duplicate.keptSource}`,
      );
    }
  });
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
