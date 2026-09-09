'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cx } from '../patterns/utils';
import type { HudSideNavSide } from './context';

export const HUD_RAIL_DRAG_COLLAPSE_MARGIN = 40;
export const HUD_RAIL_DRAG_EXPAND_TRAVEL = 24;
export const HUD_RAIL_KEYBOARD_RESIZE_STEP = 8;

type HudRailResizeCommit =
  | { kind: 'revert' }
  | { kind: 'collapse' }
  | { kind: 'expand'; width: number }
  | { kind: 'resize'; width: number };

function clamp(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}

export function resolveHudRailResizeCommit({
  startedCollapsed,
  rawWidth,
  rememberedExpandedWidth,
  collapsedWidth,
  minExpandedWidth,
  maxExpandedWidth,
  collapseMargin = HUD_RAIL_DRAG_COLLAPSE_MARGIN,
  expandTravel = HUD_RAIL_DRAG_EXPAND_TRAVEL,
}: {
  startedCollapsed: boolean;
  rawWidth: number;
  rememberedExpandedWidth: number;
  collapsedWidth: number;
  minExpandedWidth: number;
  maxExpandedWidth: number;
  collapseMargin?: number;
  expandTravel?: number;
}): HudRailResizeCommit {
  if (startedCollapsed) {
    if (rawWidth < collapsedWidth + expandTravel) return { kind: 'revert' };
    return {
      kind: 'expand',
      width:
        rawWidth >= minExpandedWidth
          ? clamp(rawWidth, minExpandedWidth, maxExpandedWidth)
          : clamp(rememberedExpandedWidth, minExpandedWidth, maxExpandedWidth),
    };
  }

  if (rawWidth <= minExpandedWidth - collapseMargin) return { kind: 'collapse' };
  return {
    kind: 'resize',
    width: clamp(rawWidth, minExpandedWidth, maxExpandedWidth),
  };
}

export interface HudRailResizeHandleProps {
  side: HudSideNavSide;
  collapsed: boolean;
  expandedWidth: number;
  collapsedWidth: number;
  defaultExpandedWidth: number;
  minExpandedWidth: number;
  maxExpandedWidth: number;
  onCollapsedChange: (collapsed: boolean) => void;
  onExpandedWidthChange: (width: number) => void;
  onResizingChange?: (resizing: boolean) => void;
  controls?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Shared primary/context rail resize handle. Pointer drags resize live, drag
 * through the inner threshold collapses without losing the remembered expanded
 * width, and dragging out from compact revives the rail. Double-click resets;
 * Arrow/Home/End and Enter/Space provide the keyboard equivalent.
 */
export function HudRailResizeHandle({
  side,
  collapsed,
  expandedWidth,
  collapsedWidth,
  defaultExpandedWidth,
  minExpandedWidth,
  maxExpandedWidth,
  onCollapsedChange,
  onExpandedWidthChange,
  onResizingChange,
  controls,
  label = 'Resize navigation',
  className,
  style,
}: HudRailResizeHandleProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const beginResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const captureTarget = event.currentTarget;
      const pointerId = event.pointerId;
      captureTarget.setPointerCapture?.(pointerId);
      const startX = event.clientX;
      const startedCollapsed = collapsed;
      const startExpandedWidth = expandedWidth;
      const startWidth = startedCollapsed ? collapsedWidth : expandedWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let rawWidth = startWidth;
      let revived = false;
      let moved = false;
      let settled = false;

      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handleCancel);
        window.removeEventListener('keydown', handleKeyDown, true);
        if (captureTarget.hasPointerCapture?.(pointerId)) {
          captureTarget.releasePointerCapture(pointerId);
        }
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        cleanupRef.current = null;
        onResizingChange?.(false);
      };

      const cancel = () => {
        if (settled) return;
        settled = true;
        onExpandedWidthChange(startExpandedWidth);
        if (revived) onCollapsedChange(startedCollapsed);
        cleanup();
      };

      function handleMove(pointerEvent: PointerEvent) {
        const delta =
          side === 'left' ? pointerEvent.clientX - startX : startX - pointerEvent.clientX;
        rawWidth = startWidth + delta;
        if (!moved && Math.abs(delta) > 2) moved = true;

        if (startedCollapsed) {
          if (!revived && rawWidth >= collapsedWidth + HUD_RAIL_DRAG_EXPAND_TRAVEL) {
            revived = true;
            onCollapsedChange(false);
            onExpandedWidthChange(
              rawWidth >= minExpandedWidth
                ? clamp(rawWidth, minExpandedWidth, maxExpandedWidth)
                : startExpandedWidth,
            );
            return;
          }
          if (revived && rawWidth >= minExpandedWidth) {
            onExpandedWidthChange(clamp(rawWidth, minExpandedWidth, maxExpandedWidth));
          }
          return;
        }

        if (rawWidth >= minExpandedWidth) {
          onExpandedWidthChange(clamp(rawWidth, minExpandedWidth, maxExpandedWidth));
        }
      }

      function handlePointerUp() {
        if (settled) return;
        settled = true;
        if (!moved) {
          cleanup();
          return;
        }
        const commit = resolveHudRailResizeCommit({
          startedCollapsed,
          rawWidth,
          rememberedExpandedWidth: startExpandedWidth,
          collapsedWidth,
          minExpandedWidth,
          maxExpandedWidth,
        });

        switch (commit.kind) {
          case 'collapse':
            onExpandedWidthChange(startExpandedWidth);
            onCollapsedChange(true);
            break;
          case 'expand':
            onExpandedWidthChange(commit.width);
            onCollapsedChange(false);
            break;
          case 'resize':
            onExpandedWidthChange(commit.width);
            break;
          case 'revert':
            onExpandedWidthChange(startExpandedWidth);
            onCollapsedChange(true);
            break;
        }
        cleanup();
      }

      function handleCancel() {
        cancel();
      }

      function handleKeyDown(keyEvent: KeyboardEvent) {
        if (keyEvent.key !== 'Escape') return;
        keyEvent.preventDefault();
        keyEvent.stopImmediatePropagation();
        cancel();
      }

      onResizingChange?.(true);
      cleanupRef.current = cleanup;
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
      window.addEventListener('pointercancel', handleCancel, { once: true });
      window.addEventListener('keydown', handleKeyDown, { capture: true });
    },
    [
      collapsed,
      collapsedWidth,
      expandedWidth,
      maxExpandedWidth,
      minExpandedWidth,
      onCollapsedChange,
      onResizingChange,
      onExpandedWidthChange,
      side,
    ],
  );

  const handleKeyboardResize = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (collapsed) onExpandedWidthChange(defaultExpandedWidth);
        onCollapsedChange(!collapsed);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        onExpandedWidthChange(minExpandedWidth);
        onCollapsedChange(false);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        onExpandedWidthChange(maxExpandedWidth);
        onCollapsedChange(false);
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const visualDelta = event.key === 'ArrowRight' ? 1 : -1;
      const widthDelta =
        (side === 'left' ? visualDelta : -visualDelta) * HUD_RAIL_KEYBOARD_RESIZE_STEP;
      if (collapsed) {
        if (widthDelta > 0) {
          onExpandedWidthChange(defaultExpandedWidth);
          onCollapsedChange(false);
        }
        return;
      }
      onExpandedWidthChange(
        clamp(expandedWidth + widthDelta, minExpandedWidth, maxExpandedWidth),
      );
    },
    [
      collapsed,
      defaultExpandedWidth,
      expandedWidth,
      maxExpandedWidth,
      minExpandedWidth,
      onCollapsedChange,
      onExpandedWidthChange,
      side,
    ],
  );

  const resetWidth = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onExpandedWidthChange(defaultExpandedWidth);
    if (collapsed) onCollapsedChange(false);
  }, [collapsed, defaultExpandedWidth, onCollapsedChange, onExpandedWidthChange]);

  return (
    <div
      role="separator"
      aria-label={label}
      aria-controls={controls}
      aria-orientation="vertical"
      aria-valuemin={collapsedWidth}
      aria-valuemax={maxExpandedWidth}
      aria-valuenow={collapsed ? collapsedWidth : Math.round(expandedWidth)}
      aria-valuetext={
        collapsed ? 'Collapsed' : `Expanded, ${Math.round(expandedWidth)} pixels wide`
      }
      tabIndex={0}
      data-hud-rail-resize-handle=""
      data-state={collapsed ? 'collapsed' : 'expanded'}
      onPointerDown={beginResize}
      onDoubleClick={resetWidth}
      onKeyDown={handleKeyboardResize}
      className={cx(
        'group/resize relative touch-none cursor-ew-resize outline-none',
        "before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']",
        'focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-inset',
        className,
      )}
      style={style}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70 transition-colors group-hover/resize:bg-accent/55 group-focus-visible/resize:bg-accent/55" />
    </div>
  );
}
