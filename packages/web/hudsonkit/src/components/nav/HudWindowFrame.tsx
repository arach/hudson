'use client';

// HudWindowFrame — a side-nav window for a macOS app with a transparent title
// bar (Tauri `titleBarStyle: "Overlay"`, Electron `hiddenInset`, a WKWebView
// with `fullSizeContentView`), where the traffic lights sit over the page.
//
// Open, the sidebar's top strip holds the lights and drags the window. Folded
// to the icon rail, the rail is too narrow for them, so:
//
//   1. a title bar grows across the whole window (0 → `titleBarHeight`, on the
//      rail's width curve) holding the lights and the `brand` after them;
//   2. the bar and the rail form an L in the chrome color;
//   3. the content becomes an inset sheet with one curved top-leading corner,
//      and the sheet's own edge is the only line (bar and rail draw none).
//
// Colors and motion come from template tokens, so a Hudson template restyles
// the frame without props (see `docs/side-nav.md#window-frame`):
//
//   --hud-window-frame-chrome    bar + rail   (default: card)
//   --hud-window-frame-sheet     content      (default: background)
//   --hud-window-frame-edge      sheet edge   (default: chrome border)
//   --hud-window-frame-radius    corner       (default: 10px)
//   --hud-window-frame-duration  fold timing  (default: 180ms)
//   --hud-window-frame-ease      fold curve   (default: Hudson's rail curve)
//
// The nav is left-hand only (the lights are on the left). Pair it with
// `<HudSideNav collapsedHeader={false} collapsedFooter={false}>` when the
// brand lives in the nav's header or footer, so it isn't drawn twice.

import React from 'react';
import { cx } from '../patterns/utils';
import {
  HudSideNavProvider,
  useHudSideNav,
  useOptionalHudSideNav,
  type HudSideNavProviderProps,
} from './context';
import { HudRailResizeHandle, type HudRailResizeLineVisibility } from './HudRailResizeHandle';

/** Folded title bar height; tall enough for the lights with the brand beside them. */
export const HUD_WINDOW_TITLE_BAR_HEIGHT = 38;
/** Open-state strip at the top of the sidebar that holds the lights. */
export const HUD_WINDOW_SIDEBAR_INSET = 44;
/**
 * macOS traffic-light geometry for an overlay title bar: the row starts 10px
 * in, is centered 16px down, and ends around x = 70; the brand starts at 84.
 */
export const HUD_WINDOW_TRAFFIC_LIGHTS = { x: 10, centerY: 16, reserve: 84 } as const;

export interface HudWindowTrafficLights {
  /** Leading edge of the lights row, from the window's left. Default 10. */
  x?: number;
  /** Vertical center of the lights, from the window's top. Default 16. */
  centerY?: number;
  /** Width kept clear of them; the brand starts here. Default 84. */
  reserve?: number;
  /**
   * Draw stand-in lights. For a browser preview of a window that has native
   * ones (the native lights are never drawn by the page).
   */
  preview?: boolean;
}

export interface HudWindowFrameProps
  extends Omit<HudSideNavProviderProps, 'children' | 'side'> {
  /** The sidebar, usually `HudSideNav`. */
  navigation: React.ReactNode;
  /** The page. Rendered in the sheet. */
  children: React.ReactNode;
  /** Mark + name shown after the lights in the folded title bar. */
  brand?: React.ReactNode;
  /** Traffic-light geometry, or `false` for a window without them. */
  trafficLights?: HudWindowTrafficLights | false;
  /** Folded title bar height. Default 38. */
  titleBarHeight?: number;
  /** Open-state strip above the nav that holds the lights. Default 44 (0 without lights). */
  sidebarInset?: number;
  /** Add drag, double-click, and keyboard resizing on the sidebar's edge. */
  resizable?: boolean;
  resizeLabel?: string;
  /** Resize hairline visibility. Default `hover`: the sheet's edge is already the line. */
  resizeLineVisibility?: HudRailResizeLineVisibility;
  /** Notified when a pointer resize starts and ends. */
  onResizingChange?: (resizing: boolean) => void;
  /** Accessible name for the content landmark. */
  contentAriaLabel?: string;
  /** id for the sidebar column (the resize handle's `aria-controls`). */
  navigationId?: string;
  className?: string;
  style?: React.CSSProperties;
}

const MOTION = 'var(--hud-window-frame-duration, 180ms) var(--hud-window-frame-ease, cubic-bezier(0.32, 0.72, 0, 1))';
const EDGE = 'var(--hud-window-frame-edge, var(--hud-chrome-border, oklch(var(--border))))';
const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties;

export function HudWindowFrame(props: HudWindowFrameProps) {
  const outer = useOptionalHudSideNav();
  if (outer) return <HudWindowFrameView {...props} />;

  const {
    defaultOpen,
    open,
    onOpenChange,
    collapsible,
    keyboardShortcut,
    persistKey,
    defaultExpandedWidth,
    expandedWidth,
    onExpandedWidthChange,
    minExpandedWidth,
    maxExpandedWidth,
    collapsedWidth,
    tooltipDelay,
  } = props;
  return (
    <HudSideNavProvider
      side="left"
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      collapsible={collapsible}
      keyboardShortcut={keyboardShortcut}
      persistKey={persistKey}
      defaultExpandedWidth={defaultExpandedWidth}
      expandedWidth={expandedWidth}
      onExpandedWidthChange={onExpandedWidthChange}
      minExpandedWidth={minExpandedWidth}
      maxExpandedWidth={maxExpandedWidth}
      collapsedWidth={collapsedWidth}
      tooltipDelay={tooltipDelay}
    >
      <HudWindowFrameView {...props} />
    </HudSideNavProvider>
  );
}

function HudWindowFrameView({
  navigation,
  children,
  brand,
  trafficLights = {},
  titleBarHeight = HUD_WINDOW_TITLE_BAR_HEIGHT,
  sidebarInset,
  resizable = false,
  resizeLabel = 'Resize sidebar',
  resizeLineVisibility = 'hover',
  onResizingChange,
  contentAriaLabel,
  navigationId,
  className,
  style,
}: HudWindowFrameProps) {
  const {
    state,
    width,
    collapsible,
    setOpen,
    expandedWidth,
    defaultExpandedWidth,
    collapsedWidth,
    minExpandedWidth,
    maxExpandedWidth,
    setExpandedWidth,
  } = useHudSideNav();
  const [resizing, setResizing] = React.useState(false);
  const generatedId = React.useId();
  const sidebarId = navigationId ?? generatedId;
  const folded = state === 'collapsed';
  const lights = trafficLights === false ? null : { ...HUD_WINDOW_TRAFFIC_LIGHTS, ...trafficLights };
  const inset = sidebarInset ?? (lights ? HUD_WINDOW_SIDEBAR_INSET : 0);
  // Every fold-driven change rides one curve; a live drag must track the pointer.
  const motion = (properties: string) =>
    resizing
      ? undefined
      : properties
          .split(',')
          .map((property) => `${property.trim()} ${MOTION}`)
          .join(', ');

  const handleResizing = React.useCallback(
    (next: boolean) => {
      setResizing(next);
      onResizingChange?.(next);
    },
    [onResizingChange],
  );

  return (
    <div
      data-hud-window-frame=""
      data-state={state}
      data-resizing={resizing ? '' : undefined}
      className={cx('relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden', className)}
      style={{
        background: 'var(--hud-window-frame-chrome, oklch(var(--card)))',
        ...style,
      }}
    >
      <header
        data-hud-window-frame-slot="title-bar"
        aria-hidden={!folded}
        inert={!folded}
        className="relative shrink-0 overflow-hidden"
        style={{
          ...DRAG,
          height: folded ? titleBarHeight : 0,
          transition: motion('height'),
        }}
      >
        {brand ? (
          <div
            className="flex items-center"
            style={{
              height: (lights?.centerY ?? titleBarHeight / 2) * 2,
              paddingLeft: lights?.reserve ?? 16,
            }}
          >
            {brand}
          </div>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          id={sidebarId}
          data-hud-window-frame-slot="navigation"
          className="relative flex shrink-0 flex-col overflow-hidden"
          style={{ width, transition: motion('width') }}
        >
          {inset > 0 ? (
            <div
              data-hud-window-frame-slot="sidebar-inset"
              aria-hidden="true"
              className="shrink-0"
              style={{ ...DRAG, height: folded ? 0 : inset, transition: motion('height') }}
            />
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col [&>nav]:flex-1">{navigation}</div>
        </aside>

        <main
          aria-label={contentAriaLabel}
          data-hud-window-frame-slot="content"
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto"
          style={{
            background: 'var(--hud-window-frame-sheet, oklch(var(--background)))',
            // Constant 1px edges so folding never shifts the page; only color and
            // corner change. Open, the left edge is the sidebar's rule.
            borderTop: `1px solid ${folded ? EDGE : 'transparent'}`,
            borderLeft: `1px solid ${EDGE}`,
            borderTopLeftRadius: folded ? 'var(--hud-window-frame-radius, 10px)' : 0,
            transition: motion('border-top-color, border-top-left-radius'),
          }}
        >
          {children}
        </main>

        {resizable && collapsible !== 'none' ? (
          <HudRailResizeHandle
            side="left"
            collapsed={folded}
            expandedWidth={expandedWidth}
            collapsedWidth={collapsedWidth}
            defaultExpandedWidth={defaultExpandedWidth}
            minExpandedWidth={minExpandedWidth}
            maxExpandedWidth={maxExpandedWidth}
            onCollapsedChange={(collapsed) => setOpen(!collapsed)}
            onExpandedWidthChange={setExpandedWidth}
            onResizingChange={handleResizing}
            controls={sidebarId}
            label={resizeLabel}
            lineVisibility={resizeLineVisibility}
            className="absolute inset-y-0 z-10 w-2"
            style={{ left: width - 4, transition: motion('left') }}
          />
        ) : null}
      </div>

      {lights?.preview ? (
        <div
          aria-hidden="true"
          data-hud-window-frame-slot="traffic-lights"
          className="pointer-events-none absolute z-20 flex gap-2"
          style={{ left: lights.x, top: lights.centerY - 6 }}
        >
          {['#ec6a5e', '#f4bf4f', '#61c554'].map((color) => (
            <span key={color} className="block h-3 w-3 rounded-full" style={{ background: color }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
