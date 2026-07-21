'use client';

import React from 'react';
import { Tooltip } from '@base-ui-components/react/tooltip';
import {
  chromeBorderStyle,
  OVERLAY_POPUP_TOOLTIP,
  OVERLAY_POSITIONER,
} from '../overlays/menuChrome';

export type HudTooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface HudTooltipProviderProps {
  children?: React.ReactNode;
  /** Open delay in ms. Rails want 0 for instant-show grouping. @default 0 */
  delay?: number;
  /** Close delay in ms. @default 0 */
  closeDelay?: number;
  /**
   * Window after close during which the next tooltip opens instantly
   * (Base UI provider grouping). @default 400
   */
  timeout?: number;
}

/**
 * Groups tooltips so adjacent rail/sidebar tips open instantly after the first.
 * Mount once near the shell (e.g. around the destinations rail).
 */
export function HudTooltipProvider({
  children,
  delay = 0,
  closeDelay = 0,
  timeout = 400,
}: HudTooltipProviderProps) {
  return (
    <Tooltip.Provider delay={delay} closeDelay={closeDelay} timeout={timeout}>
      {children}
    </Tooltip.Provider>
  );
}

export interface HudTooltipProps {
  /** Tooltip body. Prefer short mono-dense labels (rail destinations, actions). */
  content: React.ReactNode;
  /** Trigger element composed via Base UI `render` (must accept unknown props). */
  children: React.ReactElement<Record<string, unknown>>;
  side?: HudTooltipSide;
  sideOffset?: number;
  /** Per-trigger open delay override. Provider default applies when omitted. */
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Base UI Tooltip skinned to the Hudson register.
 *
 * Trigger composition: children are merged via `render` so an existing
 * `<button>` stays the focusable control (no nested buttons).
 *
 * Note: do NOT pass `nativeButton` — Tooltip.Trigger does not declare it
 * (unlike Menu/Popover). Confirmed intentional vs Base UI types.
 */
export function HudTooltip({
  content,
  children,
  side = 'right',
  sideOffset = 9,
  delay,
  closeDelay,
  disabled = false,
  className = '',
}: HudTooltipProps) {
  if (disabled || content == null || content === false) {
    return children;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={delay} closeDelay={closeDelay} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          className={OVERLAY_POSITIONER}
          side={side}
          sideOffset={sideOffset}
        >
          <Tooltip.Popup
            className={[OVERLAY_POPUP_TOOLTIP, className].filter(Boolean).join(' ')}
            style={chromeBorderStyle}
          >
            {content}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Escape hatch: raw Base UI Tooltip namespace for advanced composition. */
export { Tooltip as BaseTooltip };
