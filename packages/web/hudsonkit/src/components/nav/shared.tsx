'use client';

// Shared visual helpers for the nav subtree — kept in one place so the
// data-driven tree and the composable primitives render identically and the
// two-tier accent rule (live signal only) never drifts between them.
//
// Live tone is the themeable `--hud-nav-live` token (defaults to accent).
// Consumers retint the live dot / count / spine without `!important` overrides
// on generated utilities.

import React from 'react';
import type { HudsonIcon } from '../../icons';
import { cx } from '../patterns/utils';

/** One header register shared by primary navigation, app chrome, and contextual rails. */
export const HUD_SIDE_NAV_HEADER_HEIGHT = 48;

/** Navigation icons may be Hudson icon components or preconfigured React elements. */
export type HudNavIcon = HudsonIcon | React.ReactElement;

/** Render either icon representation through one size and color contract. */
export function renderHudNavIcon(
  icon: HudNavIcon | undefined,
  size: number,
  className?: string,
): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    const element = icon as React.ReactElement<{ size?: number; className?: string }>;
    return React.cloneElement(element, {
      size,
      className: cx(element.props.className, className),
    });
  }
  const Icon = icon;
  return <Icon size={size} className={className} />;
}

/** Left spine colour. Live wins the live token; plain selection keeps a neutral
 *  spine; everything else is transparent. Live tone is spent on live ONLY. */
export function navSpine(selected?: boolean, live?: boolean): string {
  return live
    ? 'border-l-[var(--hud-nav-live)]'
    : selected
    ? 'border-l-foreground/30'
    : 'border-l-transparent';
}

/** Row background: neutral filled chip when selected, muted wash on hover. */
export function navRowBg(selected?: boolean, selectionWash = false): string {
  if (!selected) return 'hover:bg-muted/40';
  // Selection is one uninterrupted surface. A left-edge inset conflicts with
  // rounded rows and makes compact destinations look clipped.
  return selectionWash
    ? 'bg-[var(--hud-action-tint,color-mix(in_srgb,var(--hud-ink)_10%,transparent))] text-[var(--hud-ink)]'
    : 'bg-secondary/70';
}

/** Collapsed-rail selection chip — wash or secondary. */
export function navRailSelectedBg(selectionWash = false): string {
  return selectionWash
    ? 'bg-[var(--hud-action-tint,color-mix(in_srgb,var(--hud-ink)_12%,transparent))] text-[var(--hud-ink)]'
    : 'bg-secondary/80 text-foreground';
}

/** Indentation ramps by depth but is capped so deep trees stay readable. */
export function indentFor(depth: number, compact: boolean): number {
  const base = compact ? 8 : 10;
  const step = compact ? 12 : 14;
  return base + Math.min(depth, 2) * step;
}

/** The one live-signal affordance: a pulsing dot marking live/active work. */
export function LiveDot({ compact }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center',
        compact ? 'h-2 w-2' : 'h-2.5 w-2.5',
      )}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color-mix(in_srgb,var(--hud-nav-live)_60%,transparent)] motion-reduce:animate-none" />
      <span
        className={cx(
          'relative inline-flex rounded-full bg-[var(--hud-nav-live)]',
          compact ? 'h-1 w-1' : 'h-1.5 w-1.5',
        )}
      />
    </span>
  );
}

/** Compact count badge that follows `--hud-nav-live` when the row is live. */
export function LiveCountBadge({ count, live }: { count: number; live?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border font-mono uppercase',
        'px-1.5 py-0 text-[8px] tracking-[0.1em]',
        live
          ? 'border-[color-mix(in_srgb,var(--hud-nav-live)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-nav-live)_10%,transparent)] text-[var(--hud-nav-live)]'
          : 'border-border bg-muted/40 text-foreground',
      )}
    >
      {count}
    </span>
  );
}
