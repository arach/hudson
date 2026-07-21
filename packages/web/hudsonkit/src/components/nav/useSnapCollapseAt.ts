'use client';

import { useEffect, useRef } from 'react';

export type SnapCollapseNaturalWidths = {
  collapsed: number;
  expanded: number;
};

export type UseSnapCollapseAtOptions = {
  /** Current HudSideNav morph state. */
  expanded: boolean;
  /** Open/close the morph (kit `setOpen`). */
  setOpen: (open: boolean) => void;
  /** Live AppShell left panel width. */
  width: number;
  /** AppShell setWidth. */
  setWidth: (width: number) => void;
  /** Threshold: width >= this → expand. */
  snapCollapseAt: number;
  /**
   * Band below threshold before collapsing.
   * Collapse when width <= snapCollapseAt - hysteresis.
   * @default 12
   */
  hysteresis?: number;
  /** Natural widths applied on explicit (non-resize) morph toggles. */
  naturalWidths: SnapCollapseNaturalWidths;
};

/**
 * Couples AppShell left-panel width ↔ HudSideNav compact/expanded morph.
 *
 * Two effects:
 *   A) morph → width on explicit toggle (⌘B / brand) only
 *   B) width → morph on drag, with hysteresis
 *
 * Hardening (HUD-014 / package 03):
 *   - pendingProgrammaticWidth: ignore B while setWidth settles
 *   - snappedFromResize: skip A when morph came from B (preserve drag width)
 *   - hysteresis: expand/collapse thresholds differ (no threshold flicker)
 *
 * Optional consumer glue — not wired into AppShell by default.
 * Donor: Iris package 03 `useSnapCollapseAt`.
 */
export function useSnapCollapseAt({
  expanded,
  setOpen,
  width,
  setWidth,
  snapCollapseAt,
  hysteresis = 12,
  naturalWidths,
}: UseSnapCollapseAtOptions): void {
  const previousExpanded = useRef(expanded);
  const snappedFromResize = useRef(false);
  const pendingProgrammaticWidth = useRef<number | null>(null);

  const natural = expanded ? naturalWidths.expanded : naturalWidths.collapsed;

  // Effect A — morph → width (explicit toggle only).
  useEffect(() => {
    if (previousExpanded.current === expanded) return;
    previousExpanded.current = expanded;
    if (snappedFromResize.current) {
      snappedFromResize.current = false;
      return;
    }
    pendingProgrammaticWidth.current = natural;
    setWidth(natural);
  }, [expanded, natural, setWidth]);

  // Effect B — width → morph (drag).
  useEffect(() => {
    if (pendingProgrammaticWidth.current !== null) {
      if (Math.abs(width - pendingProgrammaticWidth.current) <= 1) {
        pendingProgrammaticWidth.current = null;
      }
      return;
    }

    const expandAt = snapCollapseAt;
    const collapseAt = snapCollapseAt - hysteresis;

    if (!expanded && width >= expandAt) {
      snappedFromResize.current = true;
      setOpen(true);
      return;
    }
    if (expanded && width <= collapseAt) {
      snappedFromResize.current = true;
      setOpen(false);
    }
  }, [expanded, hysteresis, setOpen, snapCollapseAt, width]);
}

/** Contextual sidebar (roster / documents list). */
export const HUD_CONTEXT_LIST_WIDTH = 240;

/** Destinations rail — icon-only compact. */
export const HUD_DESTINATION_COMPACT_WIDTH = 52;

/** Destinations rail — icon + label expanded. */
export const HUD_DESTINATION_EXPANDED_WIDTH = 156;

/** Panel width = list + rail (collapsed morph). */
export const HUD_NAV_NATURAL_COLLAPSED =
  HUD_CONTEXT_LIST_WIDTH + HUD_DESTINATION_COMPACT_WIDTH; // 292

/** Panel width = list + rail (expanded morph). */
export const HUD_NAV_NATURAL_EXPANDED =
  HUD_CONTEXT_LIST_WIDTH + HUD_DESTINATION_EXPANDED_WIDTH; // 396

/**
 * Snap threshold — drag past this expands the destinations morph.
 * Midpoint-ish between natural collapsed (292) and expanded (396).
 */
export const HUD_NAV_SNAP_COLLAPSE_AT = 344;

/** Hysteresis band (px) below snap before collapsing. */
export const HUD_NAV_SNAP_HYSTERESIS = 12;
