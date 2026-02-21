'use client';

import { useShaper } from './ShaperProvider';

export function ShaperRightPanel() {
  const ctx = useShaper();
  const {
    openSections, toggleSection, selectedPointData,
    focusOnSelected, deleteSelectedPoint, updatePointCoord,
    searchQuery, filteredAnchors, anchorsData, selectAnchorByName, selectAndFocusAnchor,
    anchorListHeight, handleAnchorResizeStart, isResizingAnchors,
    fillEnabled, setFillEnabled, fillPattern, setFillPattern, fillWeights, setFillWeights,
    animationModeEnabled, setAnimationModeEnabled, isAnimating,
    showAnimationHandles, setShowAnimationHandles, showAnimationAngles, setShowAnimationAngles,
    animationEasing, setAnimationEasing, handleOpacity, setHandleOpacity,
    angleArcRadius, setAngleArcRadius, showAngleReference, setShowAngleReference,
    pathColor, setPathColor, bezierData,
  } = ctx;

  return (
    <>
      {/* Selected Point */}
      {selectedPointData && (
        <div className="border-b border-neutral-800/50">
          <div className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-900/30">
            <button onClick={() => toggleSection('selected')} className="flex items-center gap-2 flex-1 hover:text-neutral-300 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>
              <span className="flex-1 text-left">Selected Point</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.selected ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div className="flex items-center gap-0.5">
              <button onClick={focusOnSelected} title="Focus on point" className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h3m15 0h3M12 3v3m0 15v3M6.34 6.34l2.12 2.12m11.08 11.08l2.12 2.12M6.34 17.66l2.12-2.12m11.08-11.08l2.12-2.12"/></svg>
              </button>
              <button onClick={deleteSelectedPoint} title="Delete point (Backspace)" className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
              </button>
            </div>
          </div>
          {openSections.selected && (
            <div className="px-3 pt-3 pb-3 space-y-1.5 ml-2">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  selectedPointData.pointType === 'p0' || selectedPointData.pointType === 'p3' ? 'bg-red-500' : 'bg-blue-400'
                }`} />
                <span className="text-xs text-neutral-400 font-mono">
                  s{selectedPointData.strokeIndex}:e{selectedPointData.segmentIndex}.{selectedPointData.pointType}
                </span>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-[10px] text-neutral-600">X</span>
                  <input type="number" step="0.1" value={Math.round(selectedPointData.x * 100) / 100} onChange={(e) => updatePointCoord('x', Number(e.target.value))} className="w-full rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-mono text-neutral-300 focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex-1">
                  <span className="text-[10px] text-neutral-600">Y</span>
                  <input type="number" step="0.1" value={Math.round(selectedPointData.y * 100) / 100} onChange={(e) => updatePointCoord('y', Number(e.target.value))} className="w-full rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-mono text-neutral-300 focus:border-blue-500 focus:outline-none" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anchors */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('anchors')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><circle cx="12" cy="5" r="3"/><line x1="12" x2="12" y1="22" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
          <span className="flex-1 text-left">Anchors</span>
          <span className="text-[9px] text-neutral-600 font-normal">
            {filteredAnchors.length !== anchorsData?.anchors.length
              ? `${filteredAnchors.length}/${anchorsData?.anchors.length ?? 0}`
              : `${anchorsData?.anchors.length ?? 0}`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.anchors ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.anchors && (
          <div className="px-3 pt-3 pb-3 space-y-0.5">
            {searchQuery.trim() && (
              <div className="text-[9px] text-neutral-600 font-mono px-2 py-1 bg-neutral-900/50 rounded border border-neutral-800/50">
                {filteredAnchors.length} match{filteredAnchors.length === 1 ? '' : 'es'}
              </div>
            )}
            <div className="relative">
              <div className="overflow-y-auto space-y-0.5 frame-scrollbar" style={{ height: `${anchorListHeight}px` }}>
                {filteredAnchors.length === 0 ? (
                  <div className="text-xs text-neutral-600 py-4 space-y-1">
                    <div className="text-center">No anchors found</div>
                    <div className="text-[9px] font-mono text-neutral-700 text-center">Try: stroke:left x&gt;500 y&lt;300</div>
                  </div>
                ) : (
                  filteredAnchors.map((anchor, i) => {
                    const isNearSelected = selectedPointData && Math.hypot(selectedPointData.x - anchor.x, selectedPointData.y - anchor.y) < 10;
                    return (
                      <div key={i} className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => selectAnchorByName(anchor)}
                          className={`flex flex-1 items-center justify-between rounded px-1.5 py-1 text-xs text-left transition-colors ${
                            isNearSelected ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-white/5 text-neutral-400'
                          }`}
                        >
                          <span className="font-mono">{anchor.name}</span>
                          <span className={isNearSelected ? 'text-blue-400/60' : 'text-neutral-600'}>{anchor.x.toFixed(0)}, {anchor.y.toFixed(0)}</span>
                        </button>
                        <button onClick={() => selectAndFocusAnchor(anchor)} title="Focus" className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-neutral-600 hover:text-blue-400 hover:bg-white/5">{'\u25CE'}</button>
                      </div>
                    );
                  })
                )}
              </div>
              <div
                onMouseDown={handleAnchorResizeStart}
                className={`h-1 -mx-3 cursor-ns-resize flex items-center justify-center border-t border-neutral-800/50 hover:border-neutral-600/50 transition-colors group ${isResizingAnchors ? 'bg-blue-500/10 border-blue-500/50' : 'hover:bg-neutral-800/30'}`}
                title="Drag to resize"
              >
                <div className="w-8 h-0.5 rounded-full bg-neutral-700 group-hover:bg-neutral-500 transition-colors" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fill */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('fill')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><path d="m4 16 6-6 6 6"/><path d="m14 10 4.3 4.3c.6.6.6 1.5 0 2.1l-2.6 2.6c-.6.6-1.5.6-2.1 0L10 14"/><path d="M7 21h10"/></svg>
          <span className="flex-1 text-left">Fill</span>
          {fillEnabled && <span className="text-[9px] text-blue-400 font-normal">Enabled</span>}
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.fill ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.fill && (
          <div className="px-3 pt-3 pb-3 space-y-3 ml-2">
            <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
              <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} className="rounded" />
              <span>Enable Fill</span>
            </label>
            {fillEnabled && (
              <>
                <div className="space-y-1">
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Pattern</div>
                  <div className="flex gap-1">
                    {([{ id: 'solid' as const, label: 'Solid' }, { id: 'dither' as const, label: 'Dither' }, { id: 'halftone' as const, label: 'Dots' }, { id: 'noise' as const, label: 'Noise' }]).map((p) => (
                      <button key={p.id} onClick={() => setFillPattern(p.id)} className={`flex-1 px-2 py-1 rounded text-[9px] font-semibold transition-all ${fillPattern === p.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-neutral-800/50 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedPointData && (selectedPointData.pointType === 'p0' || selectedPointData.pointType === 'p3') && (
                  <div className="space-y-1 pt-2 border-t border-neutral-800/50">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-neutral-600">Fill Weight at Selected</span>
                      <span className="text-neutral-400 font-mono tabular-nums">{fillWeights[`${selectedPointData.strokeIndex}-${selectedPointData.segmentIndex}-${selectedPointData.pointType}`] ?? 50}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={fillWeights[`${selectedPointData.strokeIndex}-${selectedPointData.segmentIndex}-${selectedPointData.pointType}`] ?? 50} onChange={(e) => { const key = `${selectedPointData.strokeIndex}-${selectedPointData.segmentIndex}-${selectedPointData.pointType}`; setFillWeights(prev => ({ ...prev, [key]: Number(e.target.value) })); }} className="w-full h-1" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Animation */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('animation')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span className="flex-1 text-left">Animation</span>
          {animationModeEnabled && <span className="text-[9px] text-blue-400 font-normal">Mode Enabled</span>}
          {isAnimating && <span className="text-[9px] text-emerald-500 font-normal">Playing</span>}
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.animation ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.animation && (
          <div className="px-3 pt-3 pb-3 space-y-3 ml-2">
            {!animationModeEnabled && (
              <div className="text-[10px] text-neutral-600 text-center py-2 border border-neutral-800/50 rounded bg-neutral-900/20">
                Enable animation mode to access timeline controls
              </div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                <input type="checkbox" checked={showAnimationHandles} onChange={(e) => setShowAnimationHandles(e.target.checked)} className="rounded" />
                <span>Show construction handles</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                <input type="checkbox" checked={showAnimationAngles} onChange={(e) => setShowAnimationAngles(e.target.checked)} className="rounded" />
                <span>Show angle measurements</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                <input type="checkbox" checked={animationEasing} onChange={(e) => setAnimationEasing(e.target.checked)} className="rounded" />
                <span>Ease around corners</span>
                <span className="ml-auto text-[9px] text-neutral-600">(coming soon)</span>
              </label>
              {showAnimationHandles && (
                <div className="pt-2 pl-4 border-l-2 border-blue-500/20 space-y-2">
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Handle Settings</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-neutral-500">Opacity</span>
                      <span className="text-neutral-400 font-mono tabular-nums">{Math.round(handleOpacity * 100)}%</span>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.05} value={handleOpacity} onChange={(e) => setHandleOpacity(Number(e.target.value))} className="w-full h-1" />
                  </div>
                </div>
              )}
              {showAnimationAngles && (
                <div className="pt-2 pl-4 border-l-2 border-blue-500/20 space-y-2">
                  <div className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Angle Settings</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-neutral-500">Arc Radius</span>
                      <span className="text-neutral-400 font-mono tabular-nums">{angleArcRadius}px</span>
                    </div>
                    <input type="range" min={10} max={40} step={2} value={angleArcRadius} onChange={(e) => setAngleArcRadius(Number(e.target.value))} className="w-full h-1" />
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-400 transition-colors">
                    <input type="checkbox" checked={showAngleReference} onChange={(e) => setShowAngleReference(e.target.checked)} className="rounded" />
                    <span>Show reference lines</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('appearance')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          <span className="flex-1 text-left">Appearance</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.appearance ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.appearance && (
          <div className="px-3 pt-3 pb-3 space-y-2 ml-2">
            <div className="flex items-center gap-2">
              <input type="color" value={pathColor} onChange={(e) => setPathColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded border border-neutral-700 bg-transparent p-0" />
              <span className="font-mono text-xs text-neutral-400">{pathColor}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['#ff4d4d', '#4dabf7', '#69db7c', '#ffd43b', '#9775fa', '#ff922b', '#f06595', '#ffffff'].map((c) => (
                <button key={c} onClick={() => setPathColor(c)} className={`h-5 w-5 rounded-sm border transition-colors ${pathColor === c ? 'border-white' : 'border-neutral-700 hover:border-neutral-500'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <button onClick={() => toggleSection('info')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span className="flex-1 text-left">Info</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.info ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.info && (
          <div className="px-3 pt-3 pb-3 space-y-1 text-xs ml-2">
            <div className="flex justify-between rounded px-1.5 py-0.5"><span className="text-neutral-500">Canvas</span><span className="text-neutral-400 tabular-nums">1024 x 1024</span></div>
            <div className="flex justify-between rounded px-1.5 py-0.5"><span className="text-neutral-500">Segments</span><span className="text-neutral-400 tabular-nums">{bezierData?.strokes.reduce((sum, s) => sum + s.length, 0) || 0}</span></div>
            <div className="flex justify-between rounded px-1.5 py-0.5"><span className="text-neutral-500">Strokes</span><span className="text-neutral-400 tabular-nums">{bezierData?.strokes.length || 0}</span></div>
          </div>
        )}
      </div>
    </>
  );
}
