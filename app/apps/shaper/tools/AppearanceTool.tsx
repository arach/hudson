'use client';

import { useShaper } from '../ShaperProvider';

export function AppearanceTool() {
  const ctx = useShaper();
  const { pathColor, setPathColor } = ctx;

  return (
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
  );
}
