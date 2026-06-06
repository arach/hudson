// ─────────────────────────────────────────────────────────────────────────────
// Local App Registration — Example Template
// ─────────────────────────────────────────────────────────────────────────────
//
// Copy this file to app/local/apps.local.ts and add local app references:
//
//   cp app/catalog/apps.local.example.ts app/local/apps.local.ts
//
// The registry (app/apps/registry.ts) merges these into the workspace
// automatically during development. Production bundles ignore local apps.
// Keep concrete app references in your local copy, not in tracked Hudson source.
// ─────────────────────────────────────────────────────────────────────────────

import type { HudsonWorkspace, WorkspaceAppConfig } from 'hudsonkit';

export const localApps: WorkspaceAppConfig[] = [
  // Add local app configs here.
];

export const localWorkspaces: HudsonWorkspace[] = [
  // Add local workspaces here.
];
