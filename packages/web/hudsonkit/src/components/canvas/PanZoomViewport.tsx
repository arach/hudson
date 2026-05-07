'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewportPan {
  x: number;
  y: number;
}

interface PanZoomViewportProps {
  children: React.ReactNode;
  pan: ViewportPan;
  scale: number;
  onPanChange: (pan: ViewportPan) => void;
  onScaleChange?: (scale: number) => void;
  panEnabled?: boolean;
  enableSpacePan?: boolean;
  wheelZoom?: boolean;
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  className?: string;
  contentClassName?: string;
}

function clampScale(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shouldSkipSpacePan(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

const PanZoomViewport: React.FC<PanZoomViewportProps> = ({
  children,
  pan,
  scale,
  onPanChange,
  onScaleChange,
  panEnabled = false,
  enableSpacePan = true,
  wheelZoom = true,
  minScale = 0.2,
  maxScale = 3,
  zoomSensitivity = 1,
  className = '',
  contentClassName = '',
}) => {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const canPan = panEnabled || spaceHeld;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    pan: ViewportPan;
  } | null>(null);

  useEffect(() => {
    if (!enableSpacePan) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat || shouldSkipSpacePan(event.target)) return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      setSpaceHeld(false);
    };
    const handleBlur = () => setSpaceHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enableSpacePan]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pan,
    };
  }, [canPan, pan]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    onPanChange({
      x: drag.pan.x + event.clientX - drag.startX,
      y: drag.pan.y + event.clientY - drag.startY,
    });
  }, [onPanChange]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!wheelZoom || !onScaleChange || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();

    const nextScale = clampScale(scale - event.deltaY * 0.0012 * zoomSensitivity, minScale, maxScale);
    if (nextScale === scale || scale <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const cursorX = event.clientX - centerX;
    const cursorY = event.clientY - centerY;
    const scaleRatio = nextScale / scale;

    onPanChange({
      x: cursorX - (cursorX - pan.x) * scaleRatio,
      y: cursorY - (cursorY - pan.y) * scaleRatio,
    });
    onScaleChange(nextScale);
  }, [maxScale, minScale, onPanChange, onScaleChange, pan, scale, wheelZoom, zoomSensitivity]);

  return (
    <div
      className={`relative overflow-hidden ${canPan ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            transformOrigin: 'center center',
          }}
        >
          <div
            className={`flex h-full w-full items-center justify-center ${contentClassName}`}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanZoomViewport;
