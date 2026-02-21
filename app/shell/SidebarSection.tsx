'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  appName: string;
  appIcon?: React.ReactNode;
  isFocused: boolean;
  onFocus: () => void;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function SidebarSection({
  appName,
  appIcon,
  isFocused,
  onFocus,
  defaultExpanded = true,
  children,
}: SidebarSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-neutral-700/30 last:border-b-0">
      <button
        onClick={() => {
          setExpanded(e => !e);
          onFocus();
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${
          isFocused
            ? 'text-emerald-400 bg-emerald-500/5'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
        }`}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {appIcon && <span className="text-neutral-500">{appIcon}</span>}
        <span className="flex-1 text-left">{appName}</span>
      </button>
      {expanded && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
