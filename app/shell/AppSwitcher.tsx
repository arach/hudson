'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { HudsonApp } from 'frame-ui';

interface AppSwitcherProps {
  apps: HudsonApp[];
  activeId: string;
  onSwitch: (id: string) => void;
}

export function AppSwitcher({ apps, activeId, onSwitch }: AppSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = apps.find(a => a.id === activeId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Single app — just show the label, no dropdown
  if (apps.length <= 1) {
    return <span className="text-[11px] font-mono text-neutral-300">v0.1.0</span>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors"
      >
        {active?.name ?? activeId}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-[200]">
          {apps.map(app => (
            <button
              key={app.id}
              onClick={() => { onSwitch(app.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono transition-colors ${
                app.id === activeId
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-neutral-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex-1">{app.name}</span>
              {app.id === activeId && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
