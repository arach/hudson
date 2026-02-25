'use client';

import { Target } from 'lucide-react';
import { useShaper } from '../ShaperProvider';

export function AnchorsTool() {
  const ctx = useShaper();
  const {
    searchQuery, filteredAnchors, anchorsData, selectedPointData,
    selectAnchorByName, selectAndFocusAnchor,
    anchorListHeight, handleAnchorResizeStart, isResizingAnchors,
  } = ctx;

  return (
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
                  <button onClick={() => selectAndFocusAnchor(anchor)} title="Focus" className="flex h-5 w-5 items-center justify-center rounded text-neutral-600 hover:text-blue-400 hover:bg-white/5"><Target size={12} /></button>
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
  );
}
