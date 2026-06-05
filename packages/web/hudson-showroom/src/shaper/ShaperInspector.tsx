'use client';

import { RefreshCw } from 'lucide-react';
import { useShaper } from './ShaperProvider';
import { ExportSection } from './components/ExportSection';

export function ShaperInspector() {
  const ctx = useShaper();
  const {
    openSections, toggleSection, selectedPointData,
    focusOnSelected, deleteSelectedPoint, updatePointCoord,
    bezierData, projectImage, traceOptions, setTraceOptions, traceInfo, handleRetrace, isTracing,
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

      {/* Trace Options — only when an image project is active */}
      {projectImage && (
        <div className="border-t border-neutral-800/50">
          <button onClick={() => toggleSection('trace')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500 shrink-0"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span className="flex-1 text-left">Trace</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.trace ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {openSections.trace && (
            <div className="px-3 pt-2 pb-3 space-y-3 ml-2">
              {/* Trace info (read-only) */}
              {traceInfo && (
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex justify-between px-1.5 py-0.5"><span className="text-neutral-500">Image type</span><span className="text-neutral-400">{traceInfo.imageKind}</span></div>
                  <div className="flex justify-between px-1.5 py-0.5"><span className="text-neutral-500">Contours</span><span className="text-neutral-400 tabular-nums">{traceInfo.contourCount}</span></div>
                  <div className="flex justify-between px-1.5 py-0.5"><span className="text-neutral-500">Points</span><span className="text-neutral-400 tabular-nums">{traceInfo.pointCount}</span></div>
                  <div className="flex justify-between px-1.5 py-0.5"><span className="text-neutral-500">Trace time</span><span className="text-neutral-400 tabular-nums">{traceInfo.lastTraceMs}ms</span></div>
                </div>
              )}

              {/* Error tolerance */}
              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-500">Error tolerance</span>
                  <span className="text-[10px] font-mono text-neutral-600">{traceOptions.errorTolerance}</span>
                </div>
                <input type="range" min={1} max={20} step={0.5} value={traceOptions.errorTolerance}
                  onChange={e => setTraceOptions(prev => ({ ...prev, errorTolerance: Number(e.target.value) }))}
                  className="w-full accent-cyan-500 h-1" />
              </label>

              {/* Max contours */}
              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-500">Max contours</span>
                  <span className="text-[10px] font-mono text-neutral-600">{traceOptions.maxContours}</span>
                </div>
                <input type="range" min={1} max={50} step={1} value={traceOptions.maxContours}
                  onChange={e => setTraceOptions(prev => ({ ...prev, maxContours: Number(e.target.value) }))}
                  className="w-full accent-cyan-500 h-1" />
              </label>

              {/* Edge detection mode */}
              <div>
                <span className="text-[10px] text-neutral-500 block mb-1">Edge detection</span>
                <div className="flex gap-1">
                  {(['auto', 'otsu', 'canny', 'alpha'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTraceOptions(prev => ({ ...prev, edgeDetection: mode }))}
                      className={`flex-1 px-1.5 py-1 rounded text-[9px] font-mono transition-colors ${
                        traceOptions.edgeDetection === mode
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          : 'bg-neutral-800/50 text-neutral-500 border border-transparent hover:text-neutral-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <span className="text-[10px] text-neutral-500 block mb-1">Resolution</span>
                <div className="flex gap-1">
                  {(['auto', 256, 512, 1024] as const).map(res => (
                    <button
                      key={res}
                      onClick={() => setTraceOptions(prev => ({ ...prev, resolution: res }))}
                      className={`flex-1 px-1.5 py-1 rounded text-[9px] font-mono transition-colors ${
                        traceOptions.resolution === res
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          : 'bg-neutral-800/50 text-neutral-500 border border-transparent hover:text-neutral-300'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retrace button */}
              <button
                onClick={handleRetrace}
                disabled={isTracing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-[11px] font-medium hover:bg-cyan-500/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <RefreshCw size={12} className={isTracing ? 'animate-spin' : ''} />
                {isTracing ? 'Tracing' : 'Retrace'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Export — always last */}
      <ExportSection />
    </>
  );
}
