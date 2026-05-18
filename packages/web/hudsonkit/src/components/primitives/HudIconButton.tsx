'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HudDensity, HudTone } from './types';
import { toneClasses } from './types';

export interface HudIconButtonProps {
  icon: LucideIcon;
  label: string;
  tone?: HudTone;
  variant?: 'soft' | 'ghost';
  density?: HudDensity;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function HudIconButton({
  icon: Icon,
  label,
  tone = 'neutral',
  variant = 'ghost',
  density = 'default',
  selected,
  disabled,
  onClick,
  className = '',
}: HudIconButtonProps) {
  const isCompact = density === 'compact';
  const tc = selected ? toneClasses.accent : toneClasses[tone];
  const size = isCompact ? 14 : 16;

  const variantClasses = {
    soft: `border ${tc.border} ${tc.bg} ${tc.text}`,
    ghost: `border border-transparent bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground ${selected ? `${tc.text} ${tc.bg}` : ''}`,
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30',
        isCompact ? 'p-1' : 'p-1.5',
        disabled && 'opacity-50 pointer-events-none',
        variantClasses[variant],
        className,
      ].filter(Boolean).join(' ')}
    >
      <Icon size={size} />
    </button>
  );
}
