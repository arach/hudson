'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

interface SidebarSectionProps {
  appName: string;
  appIcon?: React.ReactNode;
  isFocused: boolean;
  onFocus: () => void;
  defaultExpanded?: boolean;
  /** Whether the app is currently visible on canvas */
  isVisible?: boolean;
  /** Toggle app visibility on/off */
  onToggleVisibility?: () => void;
  children: React.ReactNode;
}

export function SidebarSection({
  appName,
  appIcon,
  isFocused,
  onFocus,
  defaultExpanded = true,
  isVisible,
  onToggleVisibility,
  children,
}: SidebarSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showToggle = onToggleVisibility !== undefined;

  return (
    <div className={`border-b border-neutral-700/30 last:border-b-0 ${isVisible === false ? 'opacity-50' : ''}`}>
      <div className="flex items-center">
        <button
          onClick={() => {
            setExpanded(e => !e);
            onFocus();
          }}
          className={`flex-1 flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${
            isFocused
              ? 'text-emerald-400 bg-emerald-500/5'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
          }`}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {appIcon && <span className="text-neutral-500">{appIcon}</span>}
          <span className="flex-1 text-left">{appName}</span>
        </button>
        {showToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className={`px-2 py-2 transition-colors ${
              isVisible === false
                ? 'text-neutral-600 hover:text-neutral-400'
                : 'text-neutral-500 hover:text-emerald-400'
            }`}
            title={isVisible === false ? 'Show on canvas' : 'Hide from canvas'}
          >
            {isVisible === false ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        )}
      </div>
      {expanded && isVisible !== false && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
