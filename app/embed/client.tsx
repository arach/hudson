/**
 * Hudson Embed Client Entry
 *
 * This is the standalone React mount point used by the embed Worker's HTML.
 * It reads `window.__HUDSON_INITIAL__` (placed by the Worker) and mounts
 * the embed surface without depending on Next.js RSC hydration.
 *
 * The Worker serves a hand-crafted HTML shell that includes this bundled
 * script. This keeps the mount self-contained so the Worker's HTML works
 * whether or not Next.js RSC infrastructure is present.
 *
 * Bundle with:
 *   bun run embed:bundle
 * (defined in root package.json, uses esbuild)
 *
 * Output: public/embed/client.js (served statically from Pages)
 */

import { createRoot } from 'react-dom/client';
import { EmbedWorkspace } from './[appId]/[surface]/EmbedWorkspace';
import type { WorkspaceShellInitialState } from '../shell/WorkspaceShell';

// ── Read initial state injected by the Worker ─────────────────────────────────

declare global {
  interface Window {
    __HUDSON_INITIAL__?: {
      ref?: string;
      template: string;
      theme: 'dark' | 'light';
      activeWorkspaceId: string;
      focusedAppId: string;
      activatedAppIds: string[];
      palette?: Record<string, string>;
      fonts?: Record<string, string>;
    };
  }
}

const workerState = window.__HUDSON_INITIAL__;

// Build WorkspaceShellInitialState from the Worker-resolved state.
// tileWindowBounds is not known at Worker time — the shell defaults it.
const initialState: WorkspaceShellInitialState = workerState
  ? {
      activeWorkspaceId: workerState.activeWorkspaceId,
      activatedAppIds: workerState.activatedAppIds,
      focusedAppId: workerState.focusedAppId,
      tileWindowBounds: {}, // shell computes per-workspace defaults
      theme: workerState.theme,
      template: workerState.template,
    }
  : {
      activeWorkspaceId: 'hudson-os',
      activatedAppIds: ['hudson-docs'],
      focusedAppId: 'hudson-docs',
      tileWindowBounds: {},
      theme: 'dark',
      template: 'hudson',
    };

// ── Mount ─────────────────────────────────────────────────────────────────────

const rootEl = document.getElementById('hudson-embed-root');

if (rootEl) {
  createRoot(rootEl).render(<EmbedWorkspace initialState={initialState} />);
} else {
  console.error('[embed-client] #hudson-embed-root not found — mount failed');
}
