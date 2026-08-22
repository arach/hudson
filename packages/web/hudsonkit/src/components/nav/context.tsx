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
/** Default structural width of a full-height expanded primary navigation. */
export const HUD_SIDE_NAV_EXPANDED_WIDTH = 260;
/** Minimum expanded width accepted by the built-in resize behavior. */
export const HUD_SIDE_NAV_MIN_EXPANDED_WIDTH = 200;
/** Maximum expanded width accepted by the built-in resize behavior. */
export const HUD_SIDE_NAV_MAX_EXPANDED_WIDTH = 360;
/** Default structural width of the compact primary icon rail. */
export const HUD_SIDE_NAV_COLLAPSED_WIDTH = 48;
/** Settled-hover delay for compact rail labels. */
export const HUD_SIDE_NAV_TOOLTIP_DELAY = 500;

function clampExpandedWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}

export interface HudSideNavContextValue {
  /** `expanded` | `collapsed`. Always `expanded` when `collapsible` is `none`. */
  state: HudSideNavState;
  /** Convenience mirror of `state === 'expanded'`. */
  open: boolean;
  /** Resolved structural width for full-height sidebar compositions. */
  width: number;
  /** Configured expanded structural width. */
  expandedWidth: number;
  /** Configured default expanded width. */
  defaultExpandedWidth: number;
  /** Minimum expanded width accepted by resize controls. */
  minExpandedWidth: number;
  /** Maximum expanded width accepted by resize controls. */
  maxExpandedWidth: number;
  /** Update the remembered expanded width. */
  setExpandedWidth: (width: number) => void;
  /** Restore the configured default expanded width. */
  resetExpandedWidth: () => void;
  /** Configured compact structural width. */
  collapsedWidth: number;
  /** Hover-intent delay used by compact rail labels. */
  tooltipDelay: number;
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
  /** Initial structural width while expanded. Defaults to 260. */
  defaultExpandedWidth?: number;
  /** Controlled structural width while expanded. */
  expandedWidth?: number;
  /** Notified when resize controls update the expanded width. */
  onExpandedWidthChange?: (width: number) => void;
  /** Minimum expanded width. Defaults to 200. */
  minExpandedWidth?: number;
  /** Maximum expanded width. Defaults to 360. */
  maxExpandedWidth?: number;
  /** Structural width for `icon` collapse. Defaults to 48. */
  collapsedWidth?: number;
  /** Hover-intent delay for compact labels. Defaults to 500ms. */
  tooltipDelay?: number;
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
  defaultExpandedWidth = HUD_SIDE_NAV_EXPANDED_WIDTH,
  expandedWidth,
  onExpandedWidthChange,
  minExpandedWidth = HUD_SIDE_NAV_MIN_EXPANDED_WIDTH,
  maxExpandedWidth = HUD_SIDE_NAV_MAX_EXPANDED_WIDTH,
  collapsedWidth = HUD_SIDE_NAV_COLLAPSED_WIDTH,
  tooltipDelay = HUD_SIDE_NAV_TOOLTIP_DELAY,
}: HudSideNavProviderProps) {
  const openControlled = open !== undefined;
  const widthControlled = expandedWidth !== undefined;
  // Always call the hook (rules of hooks); `enabled:false` makes it in-memory
  // useState, so no-persistKey and controlled cases never touch storage.
  const [internalOpen, setInternalOpen] = usePersistentState(
    persistKey ?? 'hud-sidenav.open',
    defaultOpen,
    { enabled: Boolean(persistKey) && !openControlled },
  );
  const [internalExpandedWidth, setInternalExpandedWidth] = usePersistentState(
    `${persistKey ?? 'hud-sidenav'}.width`,
    defaultExpandedWidth,
    { enabled: Boolean(persistKey) && !widthControlled },
  );
  const resolvedExpandedWidth = clampExpandedWidth(
    widthControlled ? (expandedWidth as number) : internalExpandedWidth,
    minExpandedWidth,
    maxExpandedWidth,
  );

  const actualOpen =
    collapsible === 'none' ? true : openControlled ? (open as boolean) : internalOpen;
  const width =
    actualOpen || collapsible === 'none'
      ? resolvedExpandedWidth
      : collapsible === 'icon'
        ? collapsedWidth
        : 0;

  const setOpen = useCallback(
    (next: boolean) => {
      if (collapsible === 'none') return;
      if (!openControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [collapsible, openControlled, onOpenChange, setInternalOpen],
  );

  const setExpandedWidth = useCallback(
    (next: number) => {
      const clamped = clampExpandedWidth(next, minExpandedWidth, maxExpandedWidth);
      if (!widthControlled) setInternalExpandedWidth(clamped);
      onExpandedWidthChange?.(clamped);
    },
    [
      maxExpandedWidth,
      minExpandedWidth,
      onExpandedWidthChange,
      setInternalExpandedWidth,
      widthControlled,
    ],
  );

  const resetExpandedWidth = useCallback(
    () => setExpandedWidth(defaultExpandedWidth),
    [defaultExpandedWidth, setExpandedWidth],
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
      width,
      expandedWidth: resolvedExpandedWidth,
      defaultExpandedWidth,
      minExpandedWidth,
      maxExpandedWidth,
      setExpandedWidth,
      resetExpandedWidth,
      collapsedWidth,
      tooltipDelay,
      setOpen,
      toggle,
      collapsible,
      side,
    }),
    [
      actualOpen,
      width,
      resolvedExpandedWidth,
      defaultExpandedWidth,
      collapsedWidth,
      minExpandedWidth,
      maxExpandedWidth,
      tooltipDelay,
      setExpandedWidth,
      resetExpandedWidth,
      setOpen,
      toggle,
      collapsible,
      side,
    ],
  );

  return <HudSideNavContext.Provider value={value}>{children}</HudSideNavContext.Provider>;
}
