'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { HudsonWorkspace } from '@hudson/sdk';

interface WorkspaceSwitcherProps {
  workspaces: HudsonWorkspace[];
  activeId: string;
  onSwitch: (id: string) => void;
}

export function WorkspaceSwitcher({ workspaces, activeId, onSwitch }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = workspaces.find(w => w.id === activeId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Single workspace — just show the name, no dropdown
  if (workspaces.length <= 1) {
    return (
      <span className="text-[11px] font-mono text-neutral-300">
        {active?.name ?? 'Workspace'}
      </span>
    );
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
        <div className="absolute top-full left-0 mt-1 w-52 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-[200]">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono transition-colors ${
                ws.id === activeId
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-neutral-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex-1">
                {ws.name}
                {ws.description && (
                  <span className="block text-[9px] text-neutral-500 mt-0.5">{ws.description}</span>
                )}
              </span>
              {ws.id === activeId && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
