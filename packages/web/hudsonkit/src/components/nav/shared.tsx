'use client';

// Shared visual helpers for the nav subtree — kept in one place so the
// data-driven tree and the composable primitives render identically and the
// two-tier accent rule (accent === live only) never drifts between them.

import React from 'react';
import { cx } from '../patterns/utils';

/** Left spine colour. Live wins the accent; plain selection keeps a neutral
 *  spine; everything else is transparent. Accent is spent on live ONLY. */
export function navSpine(selected?: boolean, live?: boolean): string {
  return live ? 'border-l-accent' : selected ? 'border-l-foreground/30' : 'border-l-transparent';
}

/** Row background: neutral filled chip when selected, muted wash on hover. */
export function navRowBg(selected?: boolean): string {
  return selected ? 'bg-secondary/70' : 'hover:bg-muted/40';
}

/** Indentation ramps by depth but is capped so deep trees stay readable. */
export function indentFor(depth: number, compact: boolean): number {
  const base = compact ? 8 : 10;
  const step = compact ? 12 : 14;
  return base + Math.min(depth, 2) * step;
}

/** The one accent affordance: a pulsing dot marking live/active work. */
export function LiveDot({ compact }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx('relative inline-flex shrink-0 items-center justify-center', compact ? 'h-2 w-2' : 'h-2.5 w-2.5')}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
      <span className={cx('relative inline-flex rounded-full bg-accent', compact ? 'h-1 w-1' : 'h-1.5 w-1.5')} />
    </span>
  );
}
