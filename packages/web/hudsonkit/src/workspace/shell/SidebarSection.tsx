'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Settings as GearIcon } from '../../icons';
import type { ServiceStatus } from '../../index';

const SVC_DOT_COLORS: Record<ServiceStatus, string> = {
  unknown: 'bg-muted-foreground/60',
  not_installed: 'bg-muted-foreground/60',
  installed: 'bg-warning',
  running: 'bg-success',
  error: 'bg-destructive',
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
    <div className={`border-b border-border/60 last:border-b-0 ${isVisible === false ? 'opacity-50' : ''}`}>
      <div className="flex items-center">
        <button
          onClick={() => {
            setExpanded(e => !e);
            onFocus();
          }}
          className={`flex-1 flex items-center gap-2 px-3 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors ${
            isFocused
              ? 'text-accent bg-accent/[0.06]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {appIcon && <span className="text-muted-foreground">{appIcon}</span>}
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
            className="px-1.5 py-2 transition-colors text-muted-foreground/70 hover:text-foreground"
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
                ? 'text-muted-foreground/60 hover:text-foreground/80'
                : 'text-muted-foreground hover:text-accent'
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
