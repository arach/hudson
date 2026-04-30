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
// Prerequisites:
//   1. Clone hero and shaper repos alongside hudson:
//        ~/dev/hero/
//        ~/dev/shaper/
//   2. In each repo, fix bun's hudsonkit symlink for Turbopack:
//        cd ~/dev/hero/web && rm -rf node_modules/hudsonkit && ln -s ~/dev/hudson/packages/hudson-sdk node_modules/hudsonkit
//        cd ~/dev/shaper   && rm -rf node_modules/hudsonkit && ln -s ~/dev/hudson/packages/hudson-sdk node_modules/hudsonkit
//   3. Install hero's unique deps in hudson: bun add fonteditor-core opentype.js @google/genai
//
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceAppConfig, HudsonWorkspace } from 'hudsonkit';

// ─── Shaper ─────────────────────────────────────────────────────────────────
// Relative path to sibling repo (turbopack root is ~/dev/)
import { shaperApp } from '../../../shaper/src/hudson';

// ─── Hero ───────────────────────────────────────────────────────────────────
import { heroApp } from '../../../hero/web/src/hudson';

// ─── App Registration ────────────────────────────────────────────────────────

export const localApps: WorkspaceAppConfig[] = [
  // Shaper — bezier curve editor
  {
    app: shaperApp,
    canvasMode: 'windowed',
    defaultWindowBounds: { x: -400, y: -300, w: 800, h: 600 },
  },

  // Hero — font viewer
  {
    app: heroApp,
    canvasMode: 'windowed',
    defaultWindowBounds: { x: -350, y: 150, w: 900, h: 650 },
  },
];

// ─── Standalone Workspaces ───────────────────────────────────────────────────
// These appear as separate entries in the workspace switcher alongside HudsonKit.

export const localWorkspaces: HudsonWorkspace[] = [
  // Shaper in its own full-screen workspace
  {
    id: 'shaper-dev',
    name: 'Shaper.dev',
    description: 'Standalone bezier curve editor',
    mode: 'panel',
    apps: [{ app: shaperApp }],
  },

  // Hero standalone
  {
    id: 'hero-dev',
    name: 'Hero',
    description: 'Font viewer and glyph editor',
    mode: 'panel',
    apps: [{ app: heroApp }],
  },
];
