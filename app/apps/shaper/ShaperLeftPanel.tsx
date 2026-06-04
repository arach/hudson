'use client';

import { useShaper } from './ShaperProvider';
import { strokeColors } from './types';

export function ShaperLeftPanel() {
  const {
    openSections, toggleSection,
    showPath, setShowPath, showAnchors, setShowAnchors, showHandles, setShowHandles,
    showLabels, setShowLabels, showOriginal, setShowOriginal, showSilhouette, setShowSilhouette,
    showGrid, setShowGrid,
    strokeSummaries, toggleStrokeVisibility, deleteStroke, focusOnStroke,
  } = useShaper();

  const visibilityItems = [
    { id: 'showPath', label: 'Bezier Path', checked: showPath, setter: setShowPath },
    { id: 'showAnchors', label: 'Anchors', checked: showAnchors, setter: setShowAnchors },
    { id: 'showHandles', label: 'Handles', checked: showHandles, setter: setShowHandles },
    { id: 'showLabels', label: 'Labels', checked: showLabels, setter: setShowLabels },
    { id: 'showOriginal', label: 'Input Image', checked: showOriginal, setter: setShowOriginal },
    { id: 'showSilhouette', label: 'Silhouette', checked: showSilhouette, setter: setShowSilhouette },
    { id: 'showGrid', label: 'Grid', checked: showGrid, setter: setShowGrid },
  ];

  return (
    <>
      {/* Visibility */}
      <div className="border-b border-border/60">
        <button onClick={() => toggleSection('visibility')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 transition-colors border-b border-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70 shrink-0"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
          <span className="flex-1 text-left">Visibility</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/70 transition-transform ${openSections.visibility ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.visibility && (
          <div className="px-3 pt-3 pb-3 space-y-0.5">
            {visibilityItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.setter(!item.checked)}
                className="w-full flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60 transition-colors ml-2"
              >
                <span className={`flex-1 text-left ${item.checked ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-colors ${item.checked ? 'text-foreground' : 'text-muted-foreground/70'}`}>
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
      <div className="border-b border-border/60">
        <button onClick={() => toggleSection('strokes')} className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70 shrink-0"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/></svg>
          <span className="flex-1 text-left">Strokes</span>
          <span className="text-[9px] text-muted-foreground/70 font-normal">{strokeSummaries.length}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/70 transition-transform ${openSections.strokes ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {openSections.strokes && (
          <div className="px-3 pt-3 pb-3 space-y-0.5">
            {strokeSummaries.length === 0 ? (
              <div className="px-2 py-1 text-[10px] text-muted-foreground italic ml-2">No strokes</div>
            ) : strokeSummaries.map((s) => {
              const color = s.name ? (strokeColors[s.name] || '#888') : '#666';
              const label = s.name ?? `Stroke ${s.index + 1}`;
              const size = `${Math.round(s.bbox.width)}×${Math.round(s.bbox.height)}`;
              return (
                <div
                  key={s.index}
                  className={`group flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60 transition-colors ml-2 ${s.hidden ? 'opacity-40' : ''}`}
                >
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <button
                    onClick={() => focusOnStroke(s.index)}
                    className="flex-1 text-left truncate text-muted-foreground hover:text-foreground transition-colors"
                    title={`Focus ${label} (${size})`}
                  >
                    {label}
                  </button>
                  <span className="text-muted-foreground/70 text-[10px] tabular-nums">{s.segments}</span>
                  <button
                    onClick={() => toggleStrokeVisibility(s.index)}
                    className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all"
                    title={s.hidden ? 'Show stroke' : 'Hide stroke'}
                  >
                    {s.hidden ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                  <button
                    onClick={() => deleteStroke(s.index)}
                    className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    title="Delete stroke"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
