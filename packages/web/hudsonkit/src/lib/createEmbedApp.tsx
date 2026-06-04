'use client';

import { type FC, type ReactNode } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';
import type { HudsonApp, StatusColor } from '../types/app';
import type { WorkspaceAppConfig } from '../types/workspace';

const EMPTY_COMMANDS: CommandOption[] = [];
const READY_STATUS: { label: string; color: StatusColor } = { label: 'READY', color: 'emerald' };

function PassthroughProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface EmbedAppOptions {
  /** Unique identifier — used as React key and (when the shell persists) localStorage namespace. */
  id: string;
  /** Title shown in the window chrome. */
  title: string;
  /** React function component rendered inside the window. */
  component: FC;
  /** Where the window opens in canvas coordinates. Origin (0,0) is the canvas centre. */
  initialPosition?: { x: number; y: number };
  /** Default window size in CSS pixels. */
  initialSize?: { w: number; h: number };
  /** Optional status pill shown by shells that render one. */
  status?: { label: string; color: StatusColor };
  /** Short description for tooltips / palettes. */
  description?: string;
}

/**
 * Wrap a plain React component into a `HudsonApp` ready for the minimal `EmbedShell`.
 *
 * Returns a `WorkspaceAppConfig` — the same shape `HudsonWorkspace.apps` accepts —
 * with `canvasMode: 'windowed'` and `defaultWindowBounds` derived from the
 * `initialPosition` / `initialSize` you pass.
 *
 * Use this when you have an existing React component (a phone mockup, a card,
 * a documentation surface) and you want it to live in a Hudson workspace window
 * without building out the full Provider + slots + hooks contract.
 *
 * The returned app has:
 *   - a passthrough Provider (no app-owned state)
 *   - a single `Content` slot rendering your component
 *   - no commands, no search, no inspector, no ports
 *   - a static `READY` status (overridable)
 *
 * @example
 * const homeApp = createEmbedApp({
 *   id: 'talkie-home',
 *   title: 'Home',
 *   initialPosition: { x: -190, y: -380 },
 *   initialSize: { w: 380, h: 760 },
 *   component: Home,
 * });
 *
 * <EmbedShell apps={[homeApp, libraryApp]} />
 */
export function createEmbedApp(options: EmbedAppOptions): WorkspaceAppConfig {
  const Component = options.component;
  const status = options.status ?? READY_STATUS;

  const app: HudsonApp = {
    id: options.id,
    name: options.title,
    description: options.description,
    mode: 'panel',
    Provider: PassthroughProvider,
    slots: {
      Content: Component,
    },
    hooks: {
      useCommands: () => EMPTY_COMMANDS,
      useStatus: () => status,
    },
  };

  return {
    app,
    canvasMode: 'windowed',
    defaultWindowBounds: {
      x: options.initialPosition?.x ?? 0,
      y: options.initialPosition?.y ?? 0,
      w: options.initialSize?.w ?? 480,
      h: options.initialSize?.h ?? 640,
    },
  };
}
