'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { HudsonApp } from '@hudson/sdk';

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
    return <span className="text-[11px] font-mono text-foreground/80">v0.1.0</span>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-mono text-foreground/80 hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
      >
        {active?.name ?? activeId}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-[200]">
          {apps.map(app => (
            <button
              key={app.id}
              onClick={() => { onSwitch(app.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono transition-colors focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none ${
                app.id === activeId
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
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
