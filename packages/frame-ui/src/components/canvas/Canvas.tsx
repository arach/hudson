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
}

const Canvas: React.FC<CanvasProps> = ({ panOffset, scale, onPan, onPanStart, onPanEnd, isPanLocked = false, onClick, showGuides: showGuidesProp = false, onGuidesChange }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [guidesVisible, setGuidesVisible] = useState(showGuidesProp);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const pendingPanRef = useRef({ active: false, startX: 0, startY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isSpaceDownRef = useRef(false);
  const panThreshold = 4;
  const mousePosRef = useRef({ x: 0, y: 0 });
  const buttonsRef = useRef(0);
  const spaceTimeoutRef = useRef<number | null>(null);
  const lastSpaceAtRef = useRef(0);
  const spaceStaleMs = 2500;
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
    const scheduleSpaceRelease = () => {
      if (spaceTimeoutRef.current) window.clearTimeout(spaceTimeoutRef.current);
      spaceTimeoutRef.current = window.setTimeout(() => {
        if (Date.now() - lastSpaceAtRef.current < spaceStaleMs) return;
        if (isPanningRef.current) { setPanning(false); pendingPanRef.current.active = false; onPanEnd?.(); }
        isSpaceDownRef.current = false;
        document.body.style.cursor = 'default';
      }, spaceStaleMs + 50);
    };

    const handleMouseMove = (e: MouseEvent) => {
      buttonsRef.current = e.buttons;
      if (pendingPanRef.current.active && (e.buttons & 1) !== 1) { pendingPanRef.current.active = false; }
      if (isPanningRef.current && ((e.buttons & 1) !== 1 || !isSpaceDownRef.current)) {
        setPanning(false); pendingPanRef.current.active = false; onPanEnd?.();
        document.body.style.cursor = isSpaceDownRef.current ? 'grab' : 'default';
        return;
      }
      if (isPanLocked && isPanningRef.current) {
        setPanning(false); pendingPanRef.current.active = false; onPanEnd?.();
        document.body.style.cursor = isSpaceDownRef.current ? 'grab' : 'default';
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      setMousePos({ x, y });
      mousePosRef.current = { x, y };

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
      document.body.style.cursor = isSpaceDownRef.current ? 'grab' : 'default';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); setGuidesVisible(prev => { const next = !prev; onGuidesChange?.(next); return next; }); }
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        e.preventDefault();
        if (!isSpaceDownRef.current) { isSpaceDownRef.current = true; if (!isPanningRef.current) document.body.style.cursor = 'grab'; }
        lastSpaceAtRef.current = Date.now();
        scheduleSpaceRelease();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false;
        if (spaceTimeoutRef.current) { window.clearTimeout(spaceTimeoutRef.current); spaceTimeoutRef.current = null; }
        if (!isPanningRef.current) document.body.style.cursor = 'default';
      }
    };

    const handleBlur = () => {
      isSpaceDownRef.current = false; pendingPanRef.current.active = false;
      if (spaceTimeoutRef.current) { window.clearTimeout(spaceTimeoutRef.current); spaceTimeoutRef.current = null; }
      handleMouseUp(new MouseEvent('mouseup'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
      if (spaceTimeoutRef.current) window.clearTimeout(spaceTimeoutRef.current);
    };
  }, [onPan, onPanEnd, onPanStart, scale, isEditableTarget, isInteractiveTarget, isPanLocked, setPanning, onGuidesChange]);

  useEffect(() => {
    if (!isPanLocked || !isPanningRef.current) return;
    setPanning(false); onPanEnd?.();
    document.body.style.cursor = isSpaceDownRef.current ? 'grab' : 'default';
  }, [isPanLocked, onPanEnd, setPanning]);

  const handleMouseDown = (e: React.MouseEvent) => {
    didPanRef.current = false;
    if (isPanLocked || e.button !== 0 || !isSpaceDownRef.current) return;
    if (isEditableTarget(e.target) || isInteractiveTarget(e.target)) return;
    buttonsRef.current = e.buttons;
    pendingPanRef.current = { active: true, startX: e.clientX, startY: e.clientY };
    document.body.style.cursor = 'grab';
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!didPanRef.current && onClick) onClick(e);
    didPanRef.current = false;
  };

  const clampedScale = Math.max(0.4, Math.min(2, scale));
  const majorGridSize = 100 * clampedScale;
  const minorGridSize = 20 * clampedScale;
  const bgPosX = (panOffset.x * scale) % majorGridSize;
  const bgPosY = (panOffset.y * scale) % majorGridSize;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 overflow-hidden bg-black ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="absolute opacity-[0.4] pointer-events-none"
        style={{ inset: '-100px', backgroundImage: `radial-gradient(circle, #333 1px, transparent 1px)`, backgroundSize: `${minorGridSize}px ${minorGridSize}px`, backgroundPosition: `${bgPosX + 100}px ${bgPosY + 100}px` }} />
      <div className="absolute opacity-[0.15] pointer-events-none"
        style={{ inset: '-100px', backgroundImage: `radial-gradient(circle, #444 1.5px, transparent 1.5px)`, backgroundSize: `${majorGridSize}px ${majorGridSize}px`, backgroundPosition: `${bgPosX + 100}px ${bgPosY + 100}px` }} />
      {guidesVisible && (
        <>
          <div className="absolute top-0 bottom-0 w-px pointer-events-none bg-emerald-500/10" style={{ left: mousePos.x }} />
          <div className="absolute left-0 right-0 h-px pointer-events-none bg-emerald-500/10" style={{ top: mousePos.y }} />
        </>
      )}
    </div>
  );
};

export default Canvas;
