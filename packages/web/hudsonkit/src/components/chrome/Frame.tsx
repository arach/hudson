'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Canvas from '../canvas/Canvas';
import ZoomControls from './ZoomControls';
import { HudsonContextMenu } from '../overlays/ContextMenu';
import type { ContextMenuEntry } from '../overlays/ContextMenu';

interface CanvasConfig {
  showGuides?: boolean;
  onGuidesChange?: (visible: boolean) => void;
  gridOpacity?: number;
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
  /** Horizontal viewport shift in px (smoothly animated). Used to gently
   *  slide the canvas when chrome like the code workbench opens on one side. */
  viewportShiftX?: number;
  /** Context menu items shown on right-click on canvas background */
  canvasContextMenuItems?: ContextMenuEntry[];
  canvasContextMenuActivationMode?: 'default' | 'modifier';
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
  viewportShiftX = 0,
  canvasContextMenuItems,
  canvasContextMenuActivationMode,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);

  // Track scale in a ref so rapid wheel events between React renders
  // always compute deltas from the latest value (avoids stale closure).
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Stable refs for callbacks to avoid re-registering the listener on every render
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onPanStartRef = useRef(onPanStart);
  onPanStartRef.current = onPanStart;
  const onPanEndRef = useRef(onPanEnd);
  onPanEndRef.current = onPanEnd;
  const sensitivityRef = useRef(zoomSensitivity);
  sensitivityRef.current = zoomSensitivity;

  // --- Space+Hold hand tool ---
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const isSpacePanningRef = useRef(false);
  const spacePanLastRef = useRef({ x: 0, y: 0 });

  // Check whether the focused/target element is a text input or terminal —
  // stored in a ref so the window-level keydown listener always uses the latest logic
  // without needing useEffect re-registration (important for HMR).
  const shouldSkipSpaceRef = useRef((e: KeyboardEvent) => {
    const el = (e.target || document.activeElement) as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return true;
    if (el.closest?.('.xterm')) return true;
    return false;
  });

  useEffect(() => {
    if (mode !== 'canvas') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return;
      if (shouldSkipSpaceRef.current(e)) return;
      if (isTransitioning) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      if (isSpacePanningRef.current) {
        isSpacePanningRef.current = false;
        setIsSpacePanning(false);
        onPanEndRef.current?.();
      }
    };
    const onBlur = () => {
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      if (isSpacePanningRef.current) {
        isSpacePanningRef.current = false;
        setIsSpacePanning(false);
        onPanEndRef.current?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [mode, isTransitioning]);

  const handleSpaceOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isSpacePanningRef.current = true;
    setIsSpacePanning(true);
    spacePanLastRef.current = { x: e.clientX, y: e.clientY };
    onPanStartRef.current?.();
  }, []);

  useEffect(() => {
    if (!spaceHeld) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!isSpacePanningRef.current) return;
      const dx = (e.clientX - spacePanLastRef.current.x) / scaleRef.current;
      const dy = (e.clientY - spacePanLastRef.current.y) / scaleRef.current;
      spacePanLastRef.current = { x: e.clientX, y: e.clientY };
      onPanRef.current({ x: dx, y: dy });
    };
    const onMouseUp = () => {
      if (!isSpacePanningRef.current) return;
      isSpacePanningRef.current = false;
      setIsSpacePanning(false);
      onPanEndRef.current?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [spaceHeld]);

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
      <div ref={frameRef} className="fixed inset-0 bg-background text-foreground overflow-hidden font-sans select-none z-0">
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
    <div ref={frameRef} className="fixed inset-0 bg-background text-foreground overflow-hidden font-sans select-none z-0">
      {/* Layer 0: Canvas (pan/zoom background) */}
      <HudsonContextMenu items={canvasContextMenuItems ?? []} activationMode={canvasContextMenuActivationMode}>
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
          gridOpacity={canvasProps?.gridOpacity}
        />
      </HudsonContextMenu>

      {/* Layer 1: World content — zoom anchored at viewport center.
          The outer div sits at 50%/50% so CSS zoom scales from viewport center.
          The inner div applies pan offset in world space.
          viewportShiftX is a parallax nudge — the canvas drifts a touch when
          side chrome (e.g. the code workbench) appears, so it reads like the
          world is making room rather than getting covered. The small delay +
          softer curve makes the canvas feel like it's responding, not
          mechanically tracking the panel. */}
      <div
        className="absolute z-10 pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          zoom: scale,
          transform: viewportShiftX ? `translateX(${viewportShiftX}px)` : undefined,
          transition: 'transform 240ms cubic-bezier(0.34, 1.7, 0.64, 1)',
        }}
      >
        <div style={{ position: 'absolute', left: panOffset.x, top: panOffset.y }}>
          {children}
        </div>
      </div>

      {/* Space+Hold pan overlay */}
      {spaceHeld && (
        <div
          className={`fixed inset-0 z-20 ${isSpacePanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleSpaceOverlayMouseDown}
        />
      )}

      {/* Zoom controls (canvas mode) — pinned to the bottom-right of the
          visible canvas viewport. The right offset shifts the controls left
          when the shell's right inspector is open so they don't get hidden
          behind it. */}
      <div
        className="absolute z-30 transition-[bottom,right] duration-200"
        style={{
          bottom: 'calc(44px + var(--hud-player-panel-offset, 0px))',
          right: 16 + (zoomControlsRightOffset ?? 0),
        }}
      >
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
