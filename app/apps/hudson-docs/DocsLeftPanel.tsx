'use client';

import { useDocs } from './DocsProvider';
import { NAV_ITEMS, COMPONENTS } from './data';

export function DocsLeftPanel() {
  const { activeNav, setActiveNav, openSheets, toggleSheet, playSound } = useDocs();

  return (
    <>
      <div className="py-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'settings') {
                  // Trigger shell settings via keyboard event
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true }));
                } else { setActiveNav(item.id); }
                playSound('click');
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                  : 'text-neutral-300 hover:bg-white/5 hover:text-neutral-200 border-l-2 border-transparent'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-neutral-400'} />
              <span className="text-[12px] font-mono tracking-wider uppercase">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Reference cards */}
      <div className="border-t border-neutral-700/50 pt-2 pb-2">
        <div className="px-4 py-2 text-[10px] font-mono text-neutral-300 tracking-widest uppercase">Reference</div>
        {COMPONENTS.map(c => {
          const Icon = c.icon;
          const isOpen = openSheets.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => { toggleSheet(c.id); }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                isOpen
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
              }`}
            >
              <Icon size={12} className={isOpen ? 'text-emerald-400' : 'text-neutral-500'} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono tracking-wider truncate">{c.label}</div>
                <div className="text-[10px] font-mono text-neutral-400 truncate">{c.ns}</div>
              </div>
              {isOpen && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
