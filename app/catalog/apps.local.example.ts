// ─────────────────────────────────────────────────────────────────────────────
// Local App Registration — Example Template
// ─────────────────────────────────────────────────────────────────────────────
//
// Copy this file to app/local/apps.local.ts and uncomment what you need:
//
//   cp app/catalog/apps.local.example.ts app/local/apps.local.ts
//
// The registry (app/apps/registry.ts) merges these into the workspace
// automatically — no other files need editing.
//
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceAppConfig, HudsonWorkspace } from '@hudson/sdk';

// ─── Shaper (catalog app, ships with the repo) ──────────────────────────────
// Shaper lives in app/catalog/shaper/ — a complete Hudson app implementation
// you can study and load locally to see it in action.

import { shaperApp } from '../catalog/shaper';

// ─── Hero (external app, requires separate clone + symlink) ──────────────────
// Hero is an external repo. To use it:
//   1. Clone it:    git clone <hero-repo> ~/dev/hero
//   2. Symlink it:  ln -s ~/dev/hero/web node_modules/hero
//   3. Create the adapter: app/local/hero/index.ts
//
// Uncomment the import below once the adapter exists:
//
// import { heroApp } from './hero';

// ─── App Registration ────────────────────────────────────────────────────────

export const localApps: WorkspaceAppConfig[] = [
  // Shaper — bezier curve editor
  {
    app: shaperApp,
    canvasMode: 'windowed',
    defaultWindowBounds: { x: -400, y: -300, w: 800, h: 600 },
  },

  // Hero — font viewer (uncomment when adapter is ready)
  // {
  //   app: heroApp,
  //   canvasMode: 'windowed',
  //   defaultWindowBounds: { x: -350, y: 150, w: 900, h: 650 },
  // },
];

// ─── Standalone Workspaces ───────────────────────────────────────────────────
// These appear as separate entries in the workspace switcher alongside Hudson OS.

export const localWorkspaces: HudsonWorkspace[] = [
  // Shaper in its own full-screen workspace
  {
    id: 'shaper-dev',
    name: 'Shaper.dev',
    description: 'Standalone bezier curve editor',
    mode: 'panel',
    apps: [{ app: shaperApp }],
  },

  // Hero standalone (uncomment when adapter is ready)
  // {
  //   id: 'hero-dev',
  //   name: 'Hero',
  //   description: 'Font viewer and glyph editor',
  //   mode: 'panel',
  //   apps: [{ app: heroApp }],
  // },
];
