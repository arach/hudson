'use client';

import { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { LogoSvg } from './LogoSvg';
import { LogoLeftPanel } from './LogoLeftPanel';
import { LogoInspector } from './LogoInspector';

// ---------------------------------------------------------------------------
// Mini pan/zoom canvas for the logo preview area
// ---------------------------------------------------------------------------
function useCanvasControls(initial = { x: 0, y: 0, zoom: 1 }) {
  const [pan, setPan] = useState(initial);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setPan(p => ({ ...p, zoom: Math.min(8, Math.max(0.1, p.zoom * delta)) }));
    } else {
      // Pan
      setPan(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Space+click or middle mouse → pan
    if (e.button === 1 || (e.button === 0 && (e.currentTarget as HTMLElement).dataset.panning === 'true')) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const reset = useCallback(() => setPan(initial), [initial]);

  return { pan, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, reset };
}

export function LogoContent() {
  const { params } = useLogo();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [showPreviews, setShowPreviews] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const canvas = useCanvasControls();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track space key for pan mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat && !(e.target as HTMLElement).closest('input, textarea, select')) {
      e.preventDefault();
      setSpaceHeld(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') setSpaceHeld(false);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left controls panel */}
      {leftOpen && (
        <div className="w-[240px] shrink-0 border-r border-white/[0.06] overflow-y-auto frame-scrollbar bg-black/20">
          <LogoLeftPanel />
        </div>
      )}

      {/* Center canvas */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden min-w-0 ${spaceHeld ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,1) 0%, rgba(10,10,10,1) 100%)' }}
        tabIndex={0}
        data-panning={spaceHeld ? 'true' : 'false'}
        onWheel={canvas.handleWheel}
        onMouseDown={canvas.handleMouseDown}
        onMouseMove={canvas.handleMouseMove}
        onMouseUp={canvas.handleMouseUp}
        onMouseLeave={canvas.handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => setSpaceHeld(false)}
      >
        {/* Dot grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="logo-grid" width={20 * canvas.pan.zoom} height={20 * canvas.pan.zoom} patternUnits="userSpaceOnUse"
                patternTransform={`translate(${canvas.pan.x % (20 * canvas.pan.zoom)} ${canvas.pan.y % (20 * canvas.pan.zoom)})`}>
                <circle cx={10 * canvas.pan.zoom} cy={10 * canvas.pan.zoom} r={0.8} fill="rgba(255,255,255,0.15)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#logo-grid)" />
          </svg>
        </div>

        {/* Panel toggles + reset */}
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          <button
            onClick={() => setLeftOpen(v => !v)}
            className="p-1.5 rounded bg-black/40 hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors backdrop-blur-sm"
            title={leftOpen ? 'Hide controls' : 'Show controls'}
          >
            <ChevronLeft size={12} className={leftOpen ? '' : 'rotate-180'} />
          </button>
        </div>
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={canvas.reset}
            className="p-1.5 rounded bg-black/40 hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors backdrop-blur-sm"
            title="Reset view"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setRightOpen(v => !v)}
            className="p-1.5 rounded bg-black/40 hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors backdrop-blur-sm"
            title={rightOpen ? 'Hide export' : 'Show export'}
          >
            <ChevronRight size={12} className={rightOpen ? '' : 'rotate-180'} />
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-white/20">
          {Math.round(canvas.pan.zoom * 100)}%
        </div>

        {/* Canvas world */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.pan.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <div className="flex flex-col items-center gap-12">
            {/* Main preview — full 512px working resolution */}
            <div className="flex flex-col items-center gap-2">
              <LogoSvg params={params} size={512} />
              <span className="text-[11px] text-white/20">512px</span>
            </div>

            {/* Size strip + light background — toggled from inspector */}
            {showPreviews && (
              <>
                <div className="flex items-end gap-6">
                  {[256, 128, 64, 32, 16].map(size => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <LogoSvg params={params} size={size} />
                      <span className="text-[10px] text-white/15">{size}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-6 rounded-xl bg-white/90 p-6">
                  <div className="flex flex-col items-center gap-1">
                    <LogoSvg params={params} size={64} />
                    <span className="text-[10px] text-black/30">on light</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <LogoSvg params={params} size={32} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <LogoSvg params={params} size={16} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right inspector/export panel */}
      {rightOpen && (
        <div className="w-[260px] shrink-0 border-l border-white/[0.06] overflow-y-auto frame-scrollbar bg-black/20">
          <LogoInspector showPreviews={showPreviews} onTogglePreviews={() => setShowPreviews(v => !v)} />
        </div>
      )}
    </div>
  );
}
