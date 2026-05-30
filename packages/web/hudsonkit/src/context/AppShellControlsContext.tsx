'use client';

import { createContext, useContext, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// AppShell controls — imperative handles for stateful chrome features.
//
// AppShell publishes its drawer/palette/side-panel state via this context so
// app code can imperatively trigger UX flows (e.g. "code ran, pop terminal"
// or "validation failed, open inspector"). The hooks throw when called
// outside an <AppShell> so consumers don't silently noop on misuse.
//
// When a feature is chrome-disabled (e.g. `chrome.terminal = false`), the
// matching `open`/`close`/`toggle` methods are silent no-ops and `isOpen`
// always reports false — calling code doesn't need to know the chrome flags.
// ---------------------------------------------------------------------------

export type DrawerTab = 'terminal' | 'assistant';

export interface DrawerControls {
  /** Whether the drawer is currently rendered open. False when chrome.terminal is disabled. */
  isOpen: boolean;
  /** The currently selected tab, or null when no tabs are available. */
  activeTab: DrawerTab | null;
  /** Tabs the host AppShell is currently exposing — derived from app slots + assistantEnabled. */
  availableTabs: readonly DrawerTab[];
  /** Whether the drawer is in maximized mode. */
  isMaximized: boolean;
  /** Current drawer height in px (ignored while maximized). */
  height: number;
  /** Open the drawer. If a tab is given, switch to it first. No-op when chrome.terminal is disabled. */
  open(tab?: DrawerTab): void;
  /** Close the drawer. */
  close(): void;
  /** Toggle the drawer. If a tab is given, open-and-select-tab when closed; close when open and tab matches; switch tab when open and tab differs. */
  toggle(tab?: DrawerTab): void;
  /** Switch the active tab without changing open/closed state. */
  setTab(tab: DrawerTab): void;
  /** Toggle the maximized flag. */
  maximize(): void;
  /** Set the drawer height. */
  setHeight(px: number): void;
}

export interface PaletteControls {
  /** Whether the command palette is currently open. False when chrome.palette is disabled. */
  isOpen: boolean;
  /** Open the palette. No-op when chrome.palette is disabled. */
  open(): void;
  /** Close the palette. */
  close(): void;
  /** Toggle the palette. */
  toggle(): void;
}

export interface SidePanelControls {
  /** Whether the panel is collapsed to its peek button. Always false when the panel is chrome-disabled or the layout hides it. */
  isCollapsed: boolean;
  /** Current panel width in px. */
  width: number;
  /** Toggle the collapsed state. */
  toggle(): void;
  /** Explicitly set collapsed. */
  setCollapsed(value: boolean): void;
  /** Set the panel width (clamped to AppShell's resize bounds). */
  setWidth(px: number): void;
}

export interface AppShellControlsContextValue {
  drawer: DrawerControls;
  palette: PaletteControls;
  leftPanel: SidePanelControls;
  rightPanel: SidePanelControls;
}

const AppShellControlsContext = createContext<AppShellControlsContextValue | null>(null);

export function AppShellControlsProvider({
  value,
  children,
}: {
  value: AppShellControlsContextValue;
  children: ReactNode;
}) {
  return (
    <AppShellControlsContext.Provider value={value}>{children}</AppShellControlsContext.Provider>
  );
}

function useAppShellControls(hookName: string): AppShellControlsContextValue {
  const ctx = useContext(AppShellControlsContext);
  if (!ctx) {
    throw new Error(`${hookName}() must be called inside an <AppShell>`);
  }
  return ctx;
}

/** Imperative handle for the bottom drawer (terminal / assistant tabs). */
export function useAppShellDrawer(): DrawerControls {
  return useAppShellControls('useAppShellDrawer').drawer;
}

/** Imperative handle for the command palette. */
export function useAppShellPalette(): PaletteControls {
  return useAppShellControls('useAppShellPalette').palette;
}

/** Imperative handles for the left and right side panels. */
export function useAppShellSidePanels(): { left: SidePanelControls; right: SidePanelControls } {
  const ctx = useAppShellControls('useAppShellSidePanels');
  return { left: ctx.leftPanel, right: ctx.rightPanel };
}
