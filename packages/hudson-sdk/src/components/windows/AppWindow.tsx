'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, Minus, Maximize2, Minimize2, X } from 'lucide-react';
import { HudsonContextMenu } from '../overlays/ContextMenu';
import type { ContextMenuEntry } from '../overlays/ContextMenu';

// ---------------------------------------------------------------------------
// AppWindow — draggable/resizable window that lives in world space (Layer 1)
// ---------------------------------------------------------------------------

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AppWindowProps {
  title: string;
  /** Content rendered in the center of the title bar (e.g. app-specific controls) */
  titleCenter?: React.ReactNode;
  bounds: Bounds;
  onBoundsChange: (b: Bounds) => void;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
  /** CSS zoom of the parent world layer — used for 1:1 drag/resize at any zoom */
  worldScale?: number;
  /** Controlled maximize state (lifted from parent) */
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  /** Context menu items shown on right-click */
  contextMenuItems?: ContextMenuEntry[];
  children: React.ReactNode;
}

const MIN_W = 400;
const MIN_H = 300;

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const EDGE_CURSORS: Record<Edge, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

const AppWindow: React.FC<AppWindowProps> = ({
  title,
  titleCenter,
  bounds,
  onBoundsChange,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  worldScale,
  isMaximized: isMaximizedProp,
  onToggleMaximize: onToggleMaximizeProp,
  contextMenuItems,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  // Internal maximize state (used when not controlled by parent)
  const [isMaximizedInternal, setIsMaximizedInternal] = useState(false);
  const [preMaxBounds, setPreMaxBounds] = useState<Bounds | null>(null);
  const isMaximized = isMaximizedProp ?? isMaximizedInternal;
  const [altHeld, setAltHeld] = useState(false);

  // Drag guard: when true, the component is being dragged/resized.
  // During drag, liveBoundsRef holds the authoritative position and
  // React renders read from it instead of the (stale) bounds prop.
  const isDraggingRef = useRef(false);
  const liveBoundsRef = useRef(bounds);
  if (!isDraggingRef.current) {
    liveBoundsRef.current = bounds;
  }

  // Ref to onBoundsChange so closures always call the latest version
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  /** Apply bounds directly to DOM (no React re-render). */
  const applyBoundsToDOM = useCallback((b: Bounds) => {
    const el = windowRef.current;
    if (!el) return;
    el.style.left = `${b.x}px`;
    el.style.top = `${b.y}px`;
    el.style.width = `${b.w}px`;
    el.style.height = `${b.h}px`;
  }, []);

  // --- Track Alt key ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltHeld(true); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltHeld(false); };
    const onBlur = () => setAltHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // --- Option+Drag (move window from anywhere on body) ---
  const handleWindowMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onFocus();
      if (!e.altKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = { ...liveBoundsRef.current };
      const zoom = worldScale ?? 1;
      isDraggingRef.current = true;
      document.body.style.cursor = 'grabbing';

      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        liveBoundsRef.current = { ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy };
        applyBoundsToDOM(liveBoundsRef.current);
      };
      const onMouseUp = () => {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        isDraggingRef.current = false;
        onBoundsChangeRef.current(liveBoundsRef.current);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onFocus, worldScale, applyBoundsToDOM],
  );

  // --- Drag ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = { ...liveBoundsRef.current };
      isDraggingRef.current = true;

      const zoom = worldScale ?? 1;
      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        liveBoundsRef.current = { ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy };
        applyBoundsToDOM(liveBoundsRef.current);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        isDraggingRef.current = false;
        onBoundsChangeRef.current(liveBoundsRef.current);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onFocus, worldScale, applyBoundsToDOM],
  );

  // --- Resize ---
  const handleResizeStart = useCallback(
    (edge: Edge) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = { ...liveBoundsRef.current };
      isDraggingRef.current = true;

      const zoom = worldScale ?? 1;
      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;

        let { x, y, w, h } = startBounds;

        if (edge.includes('e')) w = Math.max(MIN_W, w + dx);
        if (edge.includes('w')) {
          const newW = Math.max(MIN_W, w - dx);
          x = x + (w - newW);
          w = newW;
        }
        if (edge.includes('s')) h = Math.max(MIN_H, h + dy);
        if (edge.includes('n')) {
          const newH = Math.max(MIN_H, h - dy);
          y = y + (h - newH);
          h = newH;
        }

        liveBoundsRef.current = { x, y, w, h };
        applyBoundsToDOM(liveBoundsRef.current);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        isDraggingRef.current = false;
        onBoundsChangeRef.current(liveBoundsRef.current);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onFocus, worldScale, applyBoundsToDOM],
  );

  const handleToggleMaximize = useCallback(() => {
    if (onToggleMaximizeProp) {
      onToggleMaximizeProp();
      return;
    }
    if (isMaximized && preMaxBounds) {
      onBoundsChange(preMaxBounds);
      setIsMaximizedInternal(false);
      setPreMaxBounds(null);
    } else {
      setPreMaxBounds(bounds);
      const zoom = worldScale ?? 1;
      // 98% of viewport — leaves a thin padding around the edges
      const maxW = (window.innerWidth / zoom) * 0.98;
      const maxH = (window.innerHeight / zoom) * 0.98;
      onBoundsChange({ x: -(maxW / 2), y: -(maxH / 2), w: maxW, h: maxH });
      setIsMaximizedInternal(true);
    }
  }, [isMaximized, preMaxBounds, bounds, onBoundsChange, worldScale, onToggleMaximizeProp]);

  const GRIP = 6;

  const windowEl = (
    <div
      ref={windowRef}
      className={`absolute pointer-events-auto${altHeld ? ' cursor-grab' : ''}`}
      data-app-window
      style={{
        left: liveBoundsRef.current.x,
        top: liveBoundsRef.current.y,
        width: liveBoundsRef.current.w,
        height: liveBoundsRef.current.h,
        // Maximized windows float above all siblings
        ...(isMaximized ? { zIndex: 9999 } : undefined),
      }}
      onMouseDown={handleWindowMouseDown}
    >
      {/* Window chrome */}
      <div
        className={`w-full h-full flex flex-col rounded-lg overflow-hidden border transition-shadow duration-200 ${
          isFocused
            ? 'border-accent/45 shadow-[0_24px_70px_color-mix(in_srgb,oklch(var(--accent))_18%,transparent)]'
            : 'border-border/80 shadow-[0_20px_60px_rgba(0,0,0,0.22)]'
        }`}
        style={{ background: 'color-mix(in srgb, oklch(var(--card)) 92%, transparent)', backdropFilter: 'blur(20px)' }}
      >
        {/* Title bar */}
        <div
          className="h-8 shrink-0 flex items-center px-3 gap-2 border-b border-border/70 bg-gradient-to-r from-background/70 via-card/95 to-background/70 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          {/* Left controls: expand */}
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleToggleMaximize}
              className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors"
              title={isMaximized ? 'Restore' : 'Expand'}
            >
              {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
            {onMinimize && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onMinimize}
                className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Minimize"
              >
                <Minus size={11} />
              </button>
            )}
          </div>
          <span className="flex-1 text-[12px] font-mono tracking-wider text-foreground truncate text-center">
            {title}
          </span>
          {titleCenter && (
            <div className="flex items-center shrink-0" onMouseDown={(e) => e.stopPropagation()}>
              {titleCenter}
            </div>
          )}
          {/* Right controls: close */}
          <div className="flex items-center gap-1">
            {onClose && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onClose}
                className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                title="Close"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative bg-card/78 select-text">
          {children}
        </div>
      </div>

      {/* Resize handles */}
      {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Edge[]).map((edge) => {
        const isCorner = edge.length === 2;
        const size = isCorner ? GRIP * 2 : GRIP;
        const style: React.CSSProperties = { position: 'absolute', zIndex: 10, cursor: EDGE_CURSORS[edge] };

        if (edge.includes('n')) { style.top = -size / 2; style.height = size; }
        if (edge.includes('s')) { style.bottom = -size / 2; style.height = size; }
        if (edge.includes('e')) { style.right = -size / 2; style.width = size; }
        if (edge.includes('w')) { style.left = -size / 2; style.width = size; }

        // Edges span the full length
        if (edge === 'n' || edge === 's') { style.left = size; style.right = size; }
        if (edge === 'e' || edge === 'w') { style.top = size; style.bottom = size; }

        // Corners are fixed-size squares
        if (isCorner) { style.width = size; style.height = size; }

        return <div key={edge} style={style} onMouseDown={handleResizeStart(edge)} />;
      })}
    </div>
  );

  if (contextMenuItems && contextMenuItems.length > 0) {
    return <HudsonContextMenu items={contextMenuItems}>{windowEl}</HudsonContextMenu>;
  }

  return windowEl;
};

export default AppWindow;
