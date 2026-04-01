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

  // --- Shared: compute bounds from edge drag ---
  const computeEdgeBounds = (edge: Edge, startBounds: Bounds, dx: number, dy: number): Bounds => {
    let { x, y, w, h } = startBounds;
    if (edge.includes('e')) w = Math.max(MIN_W, w + dx);
    if (edge.includes('w')) { const newW = Math.max(MIN_W, w - dx); x = x + (w - newW); w = newW; }
    if (edge.includes('s')) h = Math.max(MIN_H, h + dy);
    if (edge.includes('n')) { const newH = Math.max(MIN_H, h - dy); y = y + (h - newH); h = newH; }
    return { x, y, w, h };
  };

  // --- Apply bounds directly to DOM (skip React) ---
  const applyBoundsToDOM = useCallback((b: Bounds) => {
    const el = windowRef.current;
    if (!el) return;
    el.style.left = `${b.x}px`;
    el.style.top = `${b.y}px`;
    el.style.width = `${b.w}px`;
    el.style.height = `${b.h}px`;
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
      const startBounds = { ...bounds };
      const zoom = worldScale ?? 1;
      document.body.style.cursor = 'grabbing';

      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        applyBoundsToDOM({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
      };
      const onMouseUp = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        document.body.style.cursor = '';
        onBoundsChange({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [bounds, onBoundsChange, onFocus, worldScale, applyBoundsToDOM],
  );

  // --- Drag ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = { ...bounds };
      const zoom = worldScale ?? 1;

      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        applyBoundsToDOM({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
      };
      const onMouseUp = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        onBoundsChange({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy });
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [bounds, onBoundsChange, onFocus, worldScale, applyBoundsToDOM],
  );

  // --- Resize ---
  const handleResizeStart = useCallback(
    (edge: Edge) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = { ...bounds };
      const zoom = worldScale ?? 1;

      const onMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        applyBoundsToDOM(computeEdgeBounds(edge, startBounds, dx, dy));
      };
      const onMouseUp = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        onBoundsChange(computeEdgeBounds(edge, startBounds, dx, dy));
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [bounds, onBoundsChange, onFocus, worldScale, applyBoundsToDOM],
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
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
        // Maximized windows float above all siblings
        ...(isMaximized ? { zIndex: 9999 } : undefined),
      }}
      onMouseDown={handleWindowMouseDown}
    >
      {/* Window chrome */}
      <div
        className={`w-full h-full flex flex-col rounded-lg overflow-hidden border transition-shadow duration-200 ${
          isFocused
            ? 'border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-neutral-700/60 shadow-[0_0_30px_rgba(0,0,0,0.6)]'
        }`}
        style={{ background: 'rgba(10, 10, 10, 0.95)', backdropFilter: 'blur(20px)' }}
      >
        {/* Title bar */}
        <div
          className="h-8 shrink-0 flex items-center px-3 gap-2 border-b border-neutral-700/50 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          {/* Left controls: expand */}
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleToggleMaximize}
              className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200 transition-colors"
              title={isMaximized ? 'Restore' : 'Expand'}
            >
              {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
            {onMinimize && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onMinimize}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Minimize"
              >
                <Minus size={11} />
              </button>
            )}
          </div>
          <span className="flex-1 text-[12px] font-mono tracking-wider text-neutral-200 truncate text-center">
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
                className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                title="Close"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative">
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
