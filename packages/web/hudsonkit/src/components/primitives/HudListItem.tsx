'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HudDensity } from './types';

export interface HudListItemProps {
  children: React.ReactNode;
  selected?: boolean;
  active?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  trailingBehavior?: 'hover' | 'always';
  density?: HudDensity;
  onClick?: () => void;
  className?: string;
}

export function HudListItem({
  children,
  selected,
  active,
  disabled,
  icon: Icon,
  description,
  trailing,
  trailingBehavior = 'hover',
  density = 'default',
  onClick,
  className = '',
}: HudListItemProps) {
  const isCompact = density === 'compact';
  const interactive = !!onClick && !disabled;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); }
      } : undefined}
      className={[
        'group flex items-start gap-2 border-l-2 transition-colors',
        isCompact ? 'px-2 py-1.5' : 'px-3 py-2',
        selected
          ? 'border-l-accent bg-accent/[0.08]'
          : 'border-l-transparent',
        active && !selected && 'bg-muted/40',
        interactive && 'cursor-pointer hover:bg-muted/40',
        disabled && 'opacity-50 pointer-events-none',
        className,
      ].filter(Boolean).join(' ')}
    >
      {Icon && (
        <Icon
          size={isCompact ? 14 : 16}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-foreground/78 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
          {children}
        </div>
        {description && (
          <div className={`mt-0.5 font-mono text-muted-foreground ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            {description}
          </div>
        )}
      </div>
      {trailing && (
        <div className={[
          'shrink-0 flex items-center gap-1 transition-opacity',
          trailingBehavior === 'hover' && 'opacity-0 group-hover:opacity-100',
        ].filter(Boolean).join(' ')}>
          {trailing}
        </div>
      )}
    </div>
  );
}
