'use client';

import React, { useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, Maximize, Map, LayoutGrid } from '../../icons';

interface MinimapProps {
  pan: { x: number; y: number };
  zoom: number;
  viewportSize: { width: number; height: number };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: (pos: { x: number; y: number }) => void;
  /** Callback to fit all content in view */
  onFitAll?: () => void;
  /** Callback to auto-tile all windows in a grid layout */
  onAutoLayout?: () => void;
  children?: React.ReactNode;
  height?: number;
  footer?: React.ReactNode;
}

const MINIMAP_HEIGHT = 160;
const WORLD_SIZE = 4000;
const chromeBorderStyle = {
  borderColor: 'var(--hud-chrome-border, oklch(var(--border)))',
} satisfies React.CSSProperties;
const chromeDividerStyle = {
  backgroundColor: 'var(--hud-chrome-border, oklch(var(--border)))',
} satisfies React.CSSProperties;

const Minimap: React.FC<MinimapProps> = ({
  pan,
  zoom,
  viewportSize,
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
  onFitAll,
  onAutoLayout,
  children,
  height = MINIMAP_HEIGHT,
  footer,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onNavigate || !mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const mapWidth = rect.width;
      // Map click position to world coordinate, then negate for panOffset
      const wx = (mx / mapWidth) * WORLD_SIZE - WORLD_SIZE / 2;
      const wy = (my / height) * WORLD_SIZE - WORLD_SIZE / 2;
      onNavigate({ x: -wx, y: -wy });
    },
    [onNavigate, height]
  );

  return (
    <div
      ref={containerRef}
      data-frame-panel="minimap"
      className="select-none font-mono text-[11px] flex flex-col border-t"
      style={chromeBorderStyle}
    >
      {/* Header (always visible) */}
      <div
        className={`shrink-0 flex items-center justify-between px-3 py-1.5 ${isCollapsed ? 'cursor-pointer hover:bg-accent/10 transition-colors' : ''}`}
        onClick={isCollapsed ? onToggleCollapse : undefined}
      >
        <div className="flex items-center gap-1.5 text-foreground">
          <Map size={12} className="text-muted-foreground" />
          <span className="tracking-[0.18em] font-normal uppercase text-[10px] text-muted-foreground">Map</span>
        </div>
        <div className="flex items-center gap-1">
          {!isCollapsed && onAutoLayout && (
            <button
              onClick={onAutoLayout}
              className="p-0.5 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground"
              title="Auto-layout windows"
            >
              <LayoutGrid size={10} />
            </button>
          )}
          {!isCollapsed && onFitAll && (
            <button
              onClick={onFitAll}
              className="p-0.5 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground"
              title="Fit all in view"
            >
              <Maximize size={10} />
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={isCollapsed ? undefined : onToggleCollapse}
              className="p-0.5 hover:bg-accent/10 rounded transition-colors text-muted-foreground hover:text-foreground"
              title={isCollapsed ? 'Expand minimap' : 'Collapse minimap'}
            >
              {isCollapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      </div>

      {/* Map area + footer (hidden when collapsed) */}
      {!isCollapsed && (
        <>
          <MinimapCanvas
            ref={mapRef}
            pan={pan}
            zoom={zoom}
            viewportSize={viewportSize}
            height={height}
            onClick={handleClick}
          >
            {children}
          </MinimapCanvas>

          {footer && (
            <div className="shrink-0 border-t" style={chromeBorderStyle}>
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface MinimapCanvasProps {
  pan: { x: number; y: number };
  zoom: number;
  viewportSize: { width: number; height: number };
  height: number;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

const MinimapCanvas = React.forwardRef<HTMLDivElement, MinimapCanvasProps>(
  ({ pan, zoom, viewportSize, height, onClick, children }, ref) => {
    // Use a resize-aware approach: measure width from the container
    const [width, setWidth] = React.useState(0);
    const internalRef = useRef<HTMLDivElement>(null);
    const mergedRef = React.useCallback((node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }, [ref]);

    React.useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const safeWidth = width || 260;

    const vpWidth = (viewportSize.width / zoom / WORLD_SIZE) * safeWidth;
    const vpHeight = (viewportSize.height / zoom / WORLD_SIZE) * height;
    // pan is world-origin offset; camera looks at (-pan.x, -pan.y), so negate to match window indicators
    const vpCenterX = ((-pan.x + WORLD_SIZE / 2) / WORLD_SIZE) * safeWidth;
    const vpCenterY = ((-pan.y + WORLD_SIZE / 2) / WORLD_SIZE) * height;
    const vpX = vpCenterX - vpWidth / 2;
    const vpY = vpCenterY - vpHeight / 2;

    return (
      <div
        ref={mergedRef}
        className="relative cursor-crosshair overflow-hidden"
        style={{ height: `${height}px` }}
        onClick={onClick}
      >
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--hud-canvas-dot-major) 0.5px, transparent 0.5px)',
            backgroundSize: '14px 14px',
          }}
        />

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-0 right-0 h-px" style={chromeDividerStyle} />
        <div className="absolute left-1/2 top-0 bottom-0 w-px" style={chromeDividerStyle} />

        {/* Viewport rectangle */}
        <div
          className="absolute border bg-transparent rounded-[1px] transition-all duration-75 ease-out"
          data-frame-element="minimap-viewport"
          style={{
            left: `${vpX}px`,
            top: `${vpY}px`,
            width: `${Math.max(vpWidth, 4)}px`,
            height: `${Math.max(vpHeight, 4)}px`,
            borderColor: 'var(--hud-line-strong, var(--hud-chrome-border, oklch(var(--border))))',
          }}
        >
          <div className="absolute -top-[1px] -left-[1px] w-[3px] h-[3px] bg-accent rounded-full" />
          <div className="absolute -top-[1px] -right-[1px] w-[3px] h-[3px] bg-accent rounded-full" />
          <div className="absolute -bottom-[1px] -left-[1px] w-[3px] h-[3px] bg-accent rounded-full" />
          <div className="absolute -bottom-[1px] -right-[1px] w-[3px] h-[3px] bg-accent rounded-full" />
        </div>

        {children}
      </div>
    );
  }
);
MinimapCanvas.displayName = 'MinimapCanvas';

export default Minimap;
