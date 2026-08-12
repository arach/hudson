'use client';

// HudSideNavProvider — owns the side nav's collapse state, mirroring shadcn's
// SidebarProvider/useSidebar in the Hudson idiom.
//
// It supplies collapse state to both the data-driven `HudSideNav` and the
// composable primitives, adds a keyboard shortcut (Cmd/Ctrl+B by default), and
// persists the open/closed state through `usePersistentState` (localStorage,
// the kit's own persistence — not a cookie) when a `persistKey` is given.
//
// `HudSideNav` self-provides one when it is not already inside a provider, so
// the shipped standalone API keeps working with no wrapper.

import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';

export type HudSideNavCollapsible = 'offcanvas' | 'icon' | 'none';
export type HudSideNavSide = 'left' | 'right';
export type HudSideNavState = 'expanded' | 'collapsed';

/** The default key that toggles the sidebar with Cmd (macOS) / Ctrl. */
export const HUD_SIDE_NAV_KEYBOARD_SHORTCUT = 'b';

export interface HudSideNavContextValue {
  /** `expanded` | `collapsed`. Always `expanded` when `collapsible` is `none`. */
  state: HudSideNavState;
  /** Convenience mirror of `state === 'expanded'`. */
  open: boolean;
  /** Set the open state (no-op when `collapsible` is `none`). */
  setOpen: (open: boolean) => void;
  /** Toggle open/closed. */
  toggle: () => void;
  collapsible: HudSideNavCollapsible;
  side: HudSideNavSide;
}

const HudSideNavContext = createContext<HudSideNavContextValue | null>(null);

/** Returns the nearest sidebar context, or `null` when there is no provider. */
export function useOptionalHudSideNav(): HudSideNavContextValue | null {
  return useContext(HudSideNavContext);
}

/** Returns the nearest sidebar context; throws when used outside a provider. */
export function useHudSideNav(): HudSideNavContextValue {
  const ctx = useContext(HudSideNavContext);
  if (!ctx) {
    throw new Error('useHudSideNav must be used within a <HudSideNavProvider> or <HudSideNav>.');
  }
  return ctx;
}

export interface HudSideNavProviderProps {
  children: React.ReactNode;
  /** Initial open state when uncontrolled. Defaults to `true`. */
  defaultOpen?: boolean;
  /** Controlled open state. When set, the provider does not own the state. */
  open?: boolean;
  /** Notified on every open-state change (controlled or not). */
  onOpenChange?: (open: boolean) => void;
  /** Collapse behavior. Defaults to `icon`. */
  collapsible?: HudSideNavCollapsible;
  /** Which edge the sidebar sits on. Defaults to `left`. */
  side?: HudSideNavSide;
  /** Cmd/Ctrl + this key toggles the sidebar. `false` disables it. Defaults to `b`. */
  keyboardShortcut?: string | false;
  /** localStorage key to persist the open state (uncontrolled only). */
  persistKey?: string;
}

export function HudSideNavProvider({
  children,
  defaultOpen = true,
  open,
  onOpenChange,
  collapsible = 'icon',
  side = 'left',
  keyboardShortcut = HUD_SIDE_NAV_KEYBOARD_SHORTCUT,
  persistKey,
}: HudSideNavProviderProps) {
  const controlled = open !== undefined;
  // Always call the hook (rules of hooks); `enabled:false` makes it in-memory
  // useState, so no-persistKey and controlled cases never touch storage.
  const [internalOpen, setInternalOpen] = usePersistentState(
    persistKey ?? 'hud-sidenav.open',
    defaultOpen,
    { enabled: Boolean(persistKey) && !controlled },
  );

  const actualOpen = collapsible === 'none' ? true : controlled ? (open as boolean) : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (collapsible === 'none') return;
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [collapsible, controlled, onOpenChange, setInternalOpen],
  );

  const toggle = useCallback(() => setOpen(!actualOpen), [actualOpen, setOpen]);

  useEffect(() => {
    if (keyboardShortcut === false || collapsible === 'none') return;
    const key = (keyboardShortcut || HUD_SIDE_NAV_KEYBOARD_SHORTCUT).toLowerCase();
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== key) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboardShortcut, collapsible, toggle]);

  const value = useMemo<HudSideNavContextValue>(
    () => ({
      state: actualOpen ? 'expanded' : 'collapsed',
      open: actualOpen,
      setOpen,
      toggle,
      collapsible,
      side,
    }),
    [actualOpen, setOpen, toggle, collapsible, side],
  );

  return <HudSideNavContext.Provider value={value}>{children}</HudSideNavContext.Provider>;
}
