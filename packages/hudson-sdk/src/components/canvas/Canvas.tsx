import React, { useEffect, useState, useRef, useCallback } from 'react';

interface CanvasProps {
  panOffset: { x: number; y: number };
  scale: number;
  onPan: (delta: { x: number; y: number }) => void;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  isPanLocked?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  showGuides?: boolean;
  onGuidesChange?: (visible: boolean) => void;
  gridOpacity?: number;
}

const Canvas: React.FC<CanvasProps> = ({ panOffset, scale, onPan, onPanStart, onPanEnd, isPanLocked = false, onClick, showGuides: showGuidesProp = false, onGuidesChange, gridOpacity = 1 }) => {
  const [guidesVisible, setGuidesVisible] = useState(showGuidesProp);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const pendingPanRef = useRef({ active: false, startX: 0, startY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const guideVRef = useRef<HTMLDivElement>(null);
  const guideHRef = useRef<HTMLDivElement>(null);
  const panThreshold = 4;
  const mousePosRef = useRef({ x: 0, y: 0 });
  const buttonsRef = useRef(0);
  const didPanRef = useRef(false);

  // Sync from prop
  useEffect(() => {
    setGuidesVisible(showGuidesProp);
  }, [showGuidesProp]);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }, []);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(el.closest('button, [role="button"], a, input, textarea, select, [data-interactive="true"]'));
  }, []);

  const setPanning = useCallback((value: boolean) => {
    isPanningRef.current = value;
    setIsPanning(value);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      buttonsRef.current = e.buttons;
      if (pendingPanRef.current.active && (e.buttons & 1) !== 1) { pendingPanRef.current.active = false; }
      if (isPanningRef.current && (e.buttons & 1) !== 1) {
        setPanning(false); pendingPanRef.current.active = false; onPanEnd?.();
        document.body.style.cursor = '';
        return;
      }
      if (isPanLocked && isPanningRef.current) {
        setPanning(false); pendingPanRef.current.active = false; onPanEnd?.();
        document.body.style.cursor = '';
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      mousePosRef.current = { x, y };
      // Direct DOM updates for crosshair guides — no state, no re-render
      if (guideVRef.current) guideVRef.current.style.left = `${x}px`;
      if (guideHRef.current) guideHRef.current.style.top = `${y}px`;

      if (pendingPanRef.current.active && !isPanningRef.current) {
        const dx = e.clientX - pendingPanRef.current.startX;
        const dy = e.clientY - pendingPanRef.current.startY;
        if (Math.hypot(dx, dy) >= panThreshold) {
          pendingPanRef.current.active = false;
          setPanning(true); didPanRef.current = true; onPanStart?.();
          lastPanRef.current = { x: e.clientX, y: e.clientY };
          document.body.style.cursor = 'grabbing';
        }
      }

      if (isPanningRef.current) {
        onPan({ x: (e.clientX - lastPanRef.current.x) / scale, y: (e.clientY - lastPanRef.current.y) / scale });
        lastPanRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      buttonsRef.current = e.buttons;
      pendingPanRef.current.active = false;
      if (!isPanningRef.current) return;
      setPanning(false); onPanEnd?.();
      document.body.style.cursor = '';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); setGuidesVisible(prev => { const next = !prev; onGuidesChange?.(next); return next; }); }
    };

    const handleBlur = () => {
      pendingPanRef.current.active = false;
      handleMouseUp(new MouseEvent('mouseup'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [onPan, onPanEnd, onPanStart, scale, isEditableTarget, isInteractiveTarget, isPanLocked, setPanning, onGuidesChange]);

  useEffect(() => {
    if (!isPanLocked || !isPanningRef.current) return;
    setPanning(false); onPanEnd?.();
    document.body.style.cursor = '';
  }, [isPanLocked, onPanEnd, setPanning]);

  const handleMouseDown = (e: React.MouseEvent) => {
    didPanRef.current = false;
    if (isPanLocked || e.button !== 0) return;
    if (isEditableTarget(e.target) || isInteractiveTarget(e.target)) return;
    buttonsRef.current = e.buttons;
    pendingPanRef.current = { active: true, startX: e.clientX, startY: e.clientY };
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!didPanRef.current && onClick) onClick(e);
    didPanRef.current = false;
  };

  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setVpSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const clampedScale = Math.max(0.4, Math.min(2, scale));
  const majorGridSize = 100 * clampedScale;
  const minorGridSize = 20 * clampedScale;
  // World origin screen position: vpCenter + pan * scale
  const bgPosX = (vpSize.w / 2 + panOffset.x * scale) % majorGridSize;
  const bgPosY = (vpSize.h / 2 + panOffset.y * scale) % majorGridSize;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 overflow-hidden bg-black ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="absolute pointer-events-none"
        style={{ inset: '-100px', opacity: 0.5 * gridOpacity, transition: 'opacity 1s ease', backgroundImage: `radial-gradient(circle, #444 1px, transparent 1px)`, backgroundSize: `${minorGridSize}px ${minorGridSize}px`, backgroundPosition: `${bgPosX + 100}px ${bgPosY + 100}px` }} />
      <div className="absolute pointer-events-none"
        style={{ inset: '-100px', opacity: 0.25 * gridOpacity, transition: 'opacity 1s ease', backgroundImage: `radial-gradient(circle, #555 1.5px, transparent 1.5px)`, backgroundSize: `${majorGridSize}px ${majorGridSize}px`, backgroundPosition: `${bgPosX + 100}px ${bgPosY + 100}px` }} />
      {guidesVisible && (
        <>
          <div ref={guideVRef} className="absolute top-0 bottom-0 w-px pointer-events-none bg-emerald-500/10" style={{ left: 0 }} />
          <div ref={guideHRef} className="absolute left-0 right-0 h-px pointer-events-none bg-emerald-500/10" style={{ top: 0 }} />
        </>
      )}
    </div>
  );
};

export default Canvas;
