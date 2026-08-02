'use client';

/**
 * Shared overlay chrome for Base UI skins (ContextMenu, Menu, Popover,
 * Select, Tooltip). Hairline edges use chrome border tokens — never ink.
 * Item highlight uses accent (live/selection affordance).
 *
 * Single register so ContextMenu and hudsonkit/behaviors stay in lockstep.
 */

import type React from 'react';

export const chromeBorderStyle = {
  borderColor: 'var(--hud-chrome-border, oklch(var(--border)))',
} satisfies React.CSSProperties;

export const chromeDividerStyle = {
  backgroundColor: 'var(--hud-chrome-border, oklch(var(--border)))',
} satisfies React.CSSProperties;

/** Popup panel — menus, selects, context menus. */
export const OVERLAY_POPUP =
  'bg-popover/95 backdrop-blur-xl border rounded-lg shadow-2xl py-1 min-w-[180px] z-[200] outline-none';

/** Select list popup (fills trigger width, scroll-capped). */
export const OVERLAY_POPUP_SELECT =
  'bg-popover/95 backdrop-blur-xl border rounded-lg shadow-2xl py-0.5 min-w-[var(--anchor-width)] max-h-[min(280px,50vh)] overflow-auto z-[200] outline-none';

/** Popover body (slightly roomier padding). */
export const OVERLAY_POPUP_POPOVER =
  'bg-popover/95 backdrop-blur-xl border rounded-lg shadow-2xl px-3 py-2.5 min-w-[200px] max-w-[min(320px,90vw)] z-[200] outline-none';

/** Dense tooltip chip. */
export const OVERLAY_POPUP_TOOLTIP =
  'bg-popover border rounded-md shadow-lg px-2 py-1 min-w-0 max-w-[240px] z-[200] outline-none pointer-events-none whitespace-nowrap text-[10px] font-semibold tracking-wide text-popover-foreground';

/** Menu / select / context-menu row. */
export const OVERLAY_ITEM =
  'flex items-center gap-3 w-full px-3 py-1.5 text-[12px] font-mono text-popover-foreground outline-none select-none data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent data-[selected]:bg-accent/10 data-[selected]:text-accent data-[disabled]:opacity-40 data-[disabled]:pointer-events-none cursor-default text-left border-0 bg-transparent box-border';

export const OVERLAY_ITEM_ICON =
  'w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground';

export const OVERLAY_ITEM_LABEL = 'flex-1 min-w-0 truncate';

export const OVERLAY_ITEM_SHORTCUT =
  'text-muted-foreground text-[10px] ml-4 tracking-wider';

export const OVERLAY_ITEM_CHECK =
  'w-3 shrink-0 text-[10px] text-accent';

export const OVERLAY_GROUP_LABEL =
  'px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground';

export const OVERLAY_SEPARATOR = 'h-px my-1 border-0';

export const OVERLAY_POSITIONER = 'z-[200]';
