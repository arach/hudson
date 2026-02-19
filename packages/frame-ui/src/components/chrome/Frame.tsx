import React, { useEffect, useRef, useCallback } from 'react';
import Canvas from '../canvas/Canvas';
import ZoomControls from './ZoomControls';

interface CanvasConfig {
  showGuides?: boolean;
  onGuidesChange?: (visible: boolean) => void;
}

interface FrameProps {
  /** World-space content (scaled with pan/zoom) */
  children: React.ReactNode;
  /** Chrome UI (fixed viewport, never scales) */
  hud?: React.ReactNode;
  /** Frame mode: 'canvas' for pan/zoom, 'panel' for static scrollable layout */
  mode?: 'canvas' | 'panel';
  panOffset?: { x: number; y: number };
  scale?: number;
  onPan?: (delta: { x: number; y: number }) => void;
  onZoom?: (newScale: number, panAdjust?: { x: number; y: number }) => void;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  isTransitioning?: boolean;
  onViewportChange?: (size: { width: number; height: number }) => void;
  onCanvasClick?: (e: React.MouseEvent) => void;
  /** Canvas configuration (crosshair guides, etc.) */
  canvasProps?: CanvasConfig;
}

const noop = () => {};
const defaultPan = { x: 0, y: 0 };

const Frame: React.FC<FrameProps> = ({
  children, hud,
  mode = 'canvas',
  panOffset = defaultPan,
  scale = 1,
  onPan = noop,
  onZoom = noop,
  onPanStart, onPanEnd, isTransitioning = false,
  onViewportChange, onCanvasClick,
  canvasProps,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);

  // Zoom to cursor (canvas mode only)
  useEffect(() => {
    if (mode !== 'canvas') return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.2, scale + delta), 3);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const panAdjustX = (e.clientX - centerX) * (1 / newScale - 1 / scale);
        const panAdjustY = (e.clientY - centerY) * (1 / newScale - 1 / scale);
        onZoom(newScale, { x: panAdjustX, y: panAdjustY });
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [scale, onZoom, mode]);

  // Viewport resize
  useEffect(() => {
    if (!onViewportChange) return;
    let rafId: number | null = null;
    const notify = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        onViewportChange({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    notify();
    window.addEventListener('resize', notify);
    return () => { window.removeEventListener('resize', notify); if (rafId) cancelAnimationFrame(rafId); };
  }, [onViewportChange]);

  if (mode === 'panel') {
    return (
      <div ref={frameRef} className="fixed inset-0 bg-black text-neutral-200 overflow-hidden font-sans select-none z-0">
        {/* Panel mode: scrollable content, no canvas */}
        <div className="absolute inset-0 z-10 overflow-auto frame-scrollbar">
          {children}
        </div>

        {/* HUD chrome still renders */}
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {hud}
        </div>
      </div>
    );
  }

  return (
    <div ref={frameRef} className="fixed inset-0 bg-black text-neutral-200 overflow-hidden font-sans select-none z-0">
      {/* Layer 0: Canvas (pan/zoom background) */}
      <Canvas
        panOffset={panOffset}
        scale={scale}
        onPan={onPan}
        onPanStart={onPanStart}
        onPanEnd={onPanEnd}
        isPanLocked={isTransitioning}
        onClick={onCanvasClick}
        showGuides={canvasProps?.showGuides}
        onGuidesChange={canvasProps?.onGuidesChange}
      />

      {/* Layer 1: World content (scaled) */}
      <div
        className={`absolute inset-0 z-10 w-full h-full pointer-events-none origin-top-left will-change-transform
          ${isTransitioning ? 'transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]' : 'transition-transform duration-75 ease-out'}`}
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>

      {/* Zoom controls (canvas mode) */}
      <ZoomControls scale={scale} onZoom={(s) => onZoom(s)} />

      {/* Layer 2: Static HUD chrome (fixed, never scales) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
        {hud}
      </div>
    </div>
  );
};

export default Frame;
