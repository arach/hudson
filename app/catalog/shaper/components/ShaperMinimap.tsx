'use client';

import { useShaper } from '../ShaperProvider';

export function ShaperMinimap() {
  const { bezierData, strokesPath, pathColor, zoom, pan, resetZoom, displayImageSrc, handleMinimapClick, containerRef } = useShaper();

  return (
    <div className="border-t border-neutral-800/50">
      <div className="relative bg-neutral-950/50 cursor-crosshair" style={{ height: 120 }} onClick={handleMinimapClick}>
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
        <img src={displayImageSrc} alt="" className="absolute inset-0 w-full h-full object-contain opacity-30 pointer-events-none" />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">
          <path d={strokesPath} fill="none" stroke={pathColor} strokeWidth="8" />
        </svg>
        {/* Viewport rect */}
        {containerRef.current && (() => {
          const vw = containerRef.current!.clientWidth;
          const vh = containerRef.current!.clientHeight;
          const visX = -pan.x / zoom + 512 - vw / 2 / zoom;
          const visY = -pan.y / zoom + 512 - vh / 2 / zoom;
          const visW = vw / zoom;
          const visH = vh / zoom;
          const pctX = (visX / 1024) * 100;
          const pctY = (visY / 1024) * 100;
          const pctW = (visW / 1024) * 100;
          const pctH = (visH / 1024) * 100;
          return (
            <div
              className="absolute border border-white/30 bg-white/5 pointer-events-none"
              style={{
                left: `${Math.max(0, pctX)}%`,
                top: `${Math.max(0, pctY)}%`,
                width: `${Math.min(100, pctW)}%`,
                height: `${Math.min(100, pctH)}%`,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          );
        })()}
      </div>
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-neutral-600 font-mono bg-neutral-900/30">
        <span>{bezierData ? `${bezierData.strokes.reduce((s, st) => s + st.length, 0)} segments` : '0 segments'}</span>
        <button onClick={resetZoom} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/10 hover:text-white transition-colors" title="Fit to view">
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
          <span className="text-[9px]">FIT</span>
        </button>
      </div>
    </div>
  );
}
