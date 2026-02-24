'use client';

import { useShaper } from './ShaperProvider';
import { sounds } from '@hudson/sdk';

export function ShaperHeaderActions() {
  const { showActionsMenu, setShowActionsMenu, newProject, quickSave, handleRetrace, isTracing } = useShaper();

  return (
    <div className="relative">
      <button
        onClick={() => setShowActionsMenu(v => !v)}
        className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white"
        title="Actions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      {showActionsMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowActionsMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-black/95 backdrop-blur-xl border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-100">
            <div className="py-1">
              <button onClick={() => { newProject(); setShowActionsMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                New Project
              </button>
              <button onClick={() => { quickSave(); sounds.confirm(); setShowActionsMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                Save
                <span className="ml-auto text-[9px] text-neutral-600 font-mono">Cmd+S</span>
              </button>
              <div className="h-px bg-neutral-800 my-1" />
              <button onClick={() => { handleRetrace(); setShowActionsMenu(false); }} disabled={isTracing} className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] transition-colors ${isTracing ? 'text-blue-400' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                {isTracing ? 'Tracing...' : 'Re-trace'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
