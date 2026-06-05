'use client';

import { useShaper } from '../ShaperProvider';

export function FillTool() {
  const ctx = useShaper();
  const {
    selectedPointData,
    fillEnabled, setFillEnabled, fillPattern, setFillPattern, fillWeights, setFillWeights,
  } = ctx;

  return (
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
  );
}
