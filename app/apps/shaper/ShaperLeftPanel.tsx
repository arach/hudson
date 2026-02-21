'use client';

import { useShaper } from './ShaperProvider';
import { strokeColors } from './types';

export function ShaperLeftPanel() {
  const {
    openSections, toggleSection,
    showPath, setShowPath, showAnchors, setShowAnchors, showHandles, setShowHandles,
    showLabels, setShowLabels, showOriginal, setShowOriginal, showSilhouette, setShowSilhouette,
    showGrid, setShowGrid, strokeGroups,
  } = useShaper();

  const visibilityItems = [
    { id: 'showPath', label: 'Bezier Path', checked: showPath, setter: setShowPath },
    { id: 'showAnchors', label: 'Anchors', checked: showAnchors, setter: setShowAnchors },
    { id: 'showHandles', label: 'Handles', checked: showHandles, setter: setShowHandles },
    { id: 'showLabels', label: 'Labels', checked: showLabels, setter: setShowLabels },
    { id: 'showOriginal', label: 'Original', checked: showOriginal, setter: setShowOriginal },
    { id: 'showSilhouette', label: 'Silhouette', checked: showSilhouette, setter: setShowSilhouette },
    { id: 'showGrid', label: 'Grid', checked: showGrid, setter: setShowGrid },
  ];

  return (
    <>
      {/* Visibility */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('visibility')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors border-b border-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
          <span className="flex-1 text-left">Visibility</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.visibility ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.visibility && (
          <div className="px-3 pt-3 pb-3 space-y-0.5">
            {visibilityItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.setter(!item.checked)}
                className="w-full flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/5 transition-colors ml-2"
              >
                <span className={`flex-1 text-left ${item.checked ? 'text-neutral-400' : 'text-neutral-600'}`}>{item.label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-colors ${item.checked ? 'text-neutral-400' : 'text-neutral-700'}`}>
                  {item.checked ? (
                    <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></>
                  ) : (
                    <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></>
                  )}
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Strokes */}
      <div className="border-b border-neutral-800/50">
        <button onClick={() => toggleSection('strokes')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/></svg>
          <span className="flex-1 text-left">Strokes</span>
          <span className="text-[9px] text-neutral-600 font-normal">{strokeGroups.length}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.strokes ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.strokes && (
          <div className="px-3 pt-3 pb-3 space-y-0.5">
            {strokeGroups.map(([name, anchors]) => (
              <div key={name} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/5 transition-colors ml-2">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: strokeColors[name] || '#888' }} />
                <span className="text-neutral-400 flex-1">{name}</span>
                <span className="text-neutral-600 text-[10px]">{anchors.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
