'use client';

import React, { useCallback, useRef, useState } from 'react';
import { GripHorizontal, Minus, Maximize2, Minimize2 } from 'lucide-react';

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
  bounds: Bounds;
  onBoundsChange: (b: Bounds) => void;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize?: () => void;
  /** CSS zoom of the parent world layer — used for 1:1 drag/resize at any zoom */
  worldScale?: number;
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
  bounds,
  onBoundsChange,
  isFocused,
  onFocus,
  onMinimize,
  worldScale,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxBounds, setPreMaxBounds] = useState<Bounds | null>(null);

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
        onBoundsChange({
          ...startBounds,
          x: startBounds.x + dx,
          y: startBounds.y + dy,
        });
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [bounds, onBoundsChange, onFocus, worldScale],
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

        onBoundsChange({ x, y, w, h });
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [bounds, onBoundsChange, onFocus, worldScale],
  );

  const handleToggleMaximize = useCallback(() => {
    if (isMaximized && preMaxBounds) {
      onBoundsChange(preMaxBounds);
      setIsMaximized(false);
      setPreMaxBounds(null);
    } else {
      setPreMaxBounds(bounds);
      const zoom = worldScale ?? 1;
      const maxW = window.innerWidth / zoom;
      const maxH = window.innerHeight / zoom;
      const maxX = -(maxW / 2);
      const maxY = -(maxH / 2);
      onBoundsChange({ x: maxX, y: maxY, w: maxW, h: maxH });
      setIsMaximized(true);
    }
  }, [isMaximized, preMaxBounds, bounds, onBoundsChange, worldScale]);

  const GRIP = 6;

  return (
    <div
      ref={windowRef}
      className="absolute pointer-events-auto"
      data-app-window
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
      }}
      onMouseDown={onFocus}
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
          <GripHorizontal size={12} className="text-neutral-500" />
          <span className="flex-1 text-[11px] font-mono tracking-wider text-neutral-300 truncate">
            {title}
          </span>
          <div className="flex items-center gap-1">
            {onMinimize && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onMinimize}
                className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <Minus size={10} />
              </button>
            )}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleToggleMaximize}
              className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            </button>
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
};

export default AppWindow;
