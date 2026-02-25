'use client';

import { useShaper } from './ShaperProvider';

export function ShaperTerminal() {
  const { devTab, setDevTab, devLogs, setDevLogs, strokesPath, bezierData, zoom, pan, projectImage, selectedPointData } = useShaper();

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-3 border-b border-neutral-800/50">
        {(['path', 'log', 'info'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDevTab(tab)}
            className={`px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              devTab === tab ? 'text-neutral-200 border-b border-blue-500' : 'text-neutral-600 hover:text-neutral-400'
            }`}
          >
            {tab === 'path' ? 'SVG Path' : tab === 'log' ? 'Log' : 'Info'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <div className="flex justify-end px-3 py-1 border-b border-neutral-800/50">
          {devTab === 'path' && (
            <button onClick={() => navigator.clipboard.writeText(strokesPath)} className="text-[10px] text-neutral-600 hover:text-neutral-300">Copy</button>
          )}
          {devTab === 'log' && devLogs.length > 0 && (
            <button onClick={() => setDevLogs([])} className="text-[10px] text-neutral-600 hover:text-neutral-300">Clear</button>
          )}
        </div>
        {devTab === 'path' && (
          <pre className="p-3 text-xs font-mono text-neutral-400 leading-relaxed select-all whitespace-pre-wrap break-all">
            {strokesPath || 'No path data'}
          </pre>
        )}
        {devTab === 'log' && (
          <pre className="p-3 text-xs font-mono text-neutral-500 leading-relaxed whitespace-pre-wrap">
            {devLogs.length > 0 ? devLogs.join('\n') : 'No log output yet'}
          </pre>
        )}
        {devTab === 'info' && (
          <div className="p-3 text-xs font-mono text-neutral-500 space-y-1">
            <div>Strokes: {bezierData?.strokes.length ?? 0}</div>
            <div>Segments: {bezierData?.strokes.reduce((s, st) => s + st.length, 0) ?? 0}</div>
            <div>Canvas: 1024 x 1024</div>
            <div>Zoom: {Math.round(zoom * 100)}%</div>
            <div>Pan: {Math.round(pan.x)}, {Math.round(pan.y)}</div>
            {projectImage && <div>Image: {projectImage.name} ({projectImage.width}x{projectImage.height})</div>}
            {selectedPointData && (
              <div>Selected: s{selectedPointData.strokeIndex}:e{selectedPointData.segmentIndex}.{selectedPointData.pointType} ({selectedPointData.x.toFixed(1)}, {selectedPointData.y.toFixed(1)})</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
