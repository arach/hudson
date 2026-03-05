'use client';

import { useRef } from 'react';
import { useShaper } from '../ShaperProvider';

export function DropZone() {
  const {
    projectImage, isDragOver, setIsDragOver, imageWarnings,
    traceOptions, setTraceOptions, isTracing,
    recentImages, selectRecentImage, startProjectFromImage,
    handleDragOver, handleDragLeave, handleDrop, fileInputRef,
    setImageWarnings,
  } = useShaper();
  const dropZoneRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={dropZoneRef}
      className="absolute inset-0 flex items-center justify-center z-[5]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnter={handleDragOver}
    >
      {!projectImage ? (
        <div className="flex flex-col items-center gap-6 max-w-lg">
          <div
            className={`flex flex-col items-center justify-center w-96 h-64 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? 'border-blue-400 bg-blue-500/10 scale-[1.02]'
                : 'border-neutral-700 bg-neutral-900/50 hover:border-neutral-500 hover:bg-neutral-900'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`text-4xl mb-3 transition-transform ${isDragOver ? 'scale-110' : ''}`}>
              {isDragOver ? '+' : ''}
            </div>
            <p className="text-sm text-neutral-300 mb-1">
              {isDragOver ? 'Drop image here' : 'Drop a logo image here'}
            </p>
            <p className="text-xs text-neutral-500">or click to browse</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {['PNG', 'SVG', 'JPEG', 'WebP'].map((fmt) => (
                <span key={fmt} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">{fmt}</span>
              ))}
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-[11px] text-neutral-500">Square images work best. 512x512 or larger recommended.</p>
            <p className="text-[11px] text-neutral-600">Image type is detected automatically.</p>
          </div>
          {recentImages.length > 0 && (
            <div className="w-full max-w-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 mb-2">Recent</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {recentImages.map((recent) => (
                  <button
                    key={recent.name + recent.timestamp}
                    onClick={() => selectRecentImage(recent)}
                    className="group relative w-14 h-14 rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden hover:border-neutral-600 transition-colors"
                    title={recent.name}
                  >
                    <img src={recent.thumbnail} alt={recent.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 max-w-2xl">
          <div className="flex gap-8 items-start">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-64 h-64 rounded-lg border border-neutral-700 bg-neutral-950 overflow-hidden">
                <img src={projectImage.url} alt={projectImage.name} className="w-full h-full object-contain" />
              </div>
              <div className="text-center">
                <p className="text-xs text-neutral-400 font-mono">{projectImage.name}</p>
                <p className="text-[10px] text-neutral-600">{projectImage.width} x {projectImage.height}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 min-w-[200px]">
              <div>
                <h3 className="text-xs font-semibold text-neutral-300 mb-3">Extract shapes</h3>
                <p className="text-[11px] text-neutral-500 mb-4">
                  Trace the image contour and fit bezier curves to create editable vector paths.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Error tolerance</span>
                  <span className="font-mono text-xs text-neutral-400">{traceOptions.errorTolerance}</span>
                </div>
                <input type="range" min={1} max={20} step={0.5} value={traceOptions.errorTolerance} onChange={(e) => setTraceOptions(prev => ({ ...prev, errorTolerance: Number(e.target.value) }))} className="w-full" />
                <p className="text-[10px] text-neutral-600">Lower = more detail, more points. Higher = smoother, fewer points.</p>
              </div>
              {imageWarnings.length > 0 && (
                <div className="space-y-1">
                  {imageWarnings.map((w, i) => (
                    <p key={i} className={`text-[11px] ${w.type === 'warn' ? 'text-amber-400' : 'text-neutral-500'}`}>{w.message}</p>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => startProjectFromImage(projectImage)}
                  disabled={isTracing}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isTracing ? 'bg-blue-600/20 text-blue-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {isTracing ? 'Extracting...' : 'Extract Shapes'}
                </button>
                <button
                  onClick={() => {
                    if (projectImage.url.startsWith('blob:')) URL.revokeObjectURL(projectImage.url);
                    // We need to clear the image — accessing parent state through context
                    setImageWarnings([]);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
