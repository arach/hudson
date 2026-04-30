'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Settings as GearIcon } from 'lucide-react';
import type { ServiceStatus } from 'hudsonkit';

const SVC_DOT_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-neutral-500',
  not_installed: 'bg-neutral-500',
  installed: 'bg-amber-500',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
};

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
  /** Service dependency statuses for health dots */
  serviceDeps?: { serviceId: string; status: ServiceStatus }[];
  /** Opens the Workspace Manager focused on this app */
  onOpenManager?: () => void;
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
  serviceDeps,
  onOpenManager,
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
          className={`flex-1 flex items-center gap-2 px-3 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors ${
            isFocused
              ? 'text-emerald-400 bg-emerald-500/5'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]'
          }`}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {appIcon && <span className="text-neutral-400">{appIcon}</span>}
          <span className="flex-1 text-left">{appName}</span>
          {/* Service health dots */}
          {serviceDeps && serviceDeps.length > 0 && (
            <span className="flex items-center gap-0.5 ml-1">
              {serviceDeps.map(d => (
                <span
                  key={d.serviceId}
                  className={`w-1.5 h-1.5 rounded-full ${SVC_DOT_COLORS[d.status]}`}
                  title={`${d.serviceId}: ${d.status}`}
                />
              ))}
            </span>
          )}
        </button>
        {/* Gear icon — opens Workspace Manager */}
        {onOpenManager && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenManager();
            }}
            className="px-1.5 py-2 transition-colors text-neutral-500 hover:text-neutral-200"
            title="Open Workspace Manager"
          >
            <GearIcon size={10} />
          </button>
        )}
        {showToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className={`px-2 py-2 transition-colors ${
              isVisible === false
                ? 'text-neutral-500 hover:text-neutral-300'
                : 'text-neutral-400 hover:text-emerald-400'
            }`}
            title={isVisible === false ? 'Show on canvas' : 'Hide from canvas'}
          >
            {isVisible === false ? <EyeOff size={11} /> : <Eye size={11} />}
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
