import React, { useEffect, useRef } from 'react';
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
  /** Multiplier for zoom wheel sensitivity (default 1.0) */
  zoomSensitivity?: number;
  /** Right offset for zoom controls in px (tracks right panel width) */
  zoomControlsRightOffset?: number;
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
  zoomSensitivity,
  zoomControlsRightOffset,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);

  // Track scale in a ref so rapid wheel events between React renders
  // always compute deltas from the latest value (avoids stale closure).
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Stable refs for callbacks to avoid re-registering the listener on every render
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const sensitivityRef = useRef(zoomSensitivity);
  sensitivityRef.current = zoomSensitivity;

  // Zoom (canvas mode only) — only changes scale, no pan adjustment needed.
  // The world layer is positioned at 50%/50% so CSS zoom anchors at viewport center.
  useEffect(() => {
    if (mode !== 'canvas') return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const prevScale = scaleRef.current;
        const delta = -e.deltaY * 0.001 * (sensitivityRef.current ?? 1);
        const newScale = Math.min(Math.max(0.2, prevScale + delta), 3);
        scaleRef.current = newScale;
        onZoomRef.current(newScale);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [mode]);

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
        <div className="absolute inset-0 z-10 overflow-auto frame-scrollbar">
          {children}
        </div>
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

      {/* Layer 1: World content — zoom anchored at viewport center.
          The outer div sits at 50%/50% so CSS zoom scales from viewport center.
          The inner div applies pan offset in world space. */}
      <div
        className="absolute z-10 pointer-events-none"
        style={{ left: '50%', top: '50%', zoom: scale }}
      >
        <div style={{ position: 'absolute', left: panOffset.x, top: panOffset.y }}>
          {children}
        </div>
      </div>

      {/* Zoom controls (canvas mode) */}
      <div className="fixed bottom-[36px] z-30" style={{ right: (zoomControlsRightOffset ?? 280) + 16 }}>
        <ZoomControls scale={scale} onZoom={(s) => onZoom(s)} />
      </div>

      {/* Layer 2: Static HUD chrome (fixed, never scales) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
        {hud}
      </div>
    </div>
  );
};

export default Frame;
