'use client';

import { useShaper } from '../ShaperProvider';

export function AnimationTool() {
  const ctx = useShaper();
  const {
    animationModeEnabled,
    showAnimationHandles, setShowAnimationHandles,
    showAnimationAngles, setShowAnimationAngles,
    animationEasing, setAnimationEasing,
    handleOpacity, setHandleOpacity,
    angleArcRadius, setAngleArcRadius,
    showAngleReference, setShowAngleReference,
  } = ctx;

  return (
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
  );
}
