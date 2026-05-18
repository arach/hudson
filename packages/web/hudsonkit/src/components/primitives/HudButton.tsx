'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HudDensity, HudTone } from './types';
import { toneClasses } from './types';

export interface HudButtonProps {
  children: React.ReactNode;
  tone?: HudTone;
  variant?: 'solid' | 'soft' | 'ghost';
  density?: HudDensity;
  icon?: LucideIcon;
  iconAfter?: LucideIcon;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function HudButton({
  children,
  tone = 'neutral',
  variant = 'soft',
  density = 'default',
  icon: Icon,
  iconAfter: IconAfter,
  selected,
  disabled,
  loading,
  onClick,
  className = '',
}: HudButtonProps) {
  const isCompact = density === 'compact';
  const tc = selected ? toneClasses.accent : toneClasses[tone];

  const base = [
    'inline-flex items-center justify-center gap-1.5 rounded-md font-mono uppercase transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:border-ring',
    isCompact
      ? 'px-2 py-1 text-[10px] tracking-[0.12em]'
      : 'px-2.5 py-1.5 text-[11px] tracking-[0.12em]',
    (disabled || loading) && 'opacity-50 pointer-events-none',
  ];

  const variantClasses = {
    solid: `border ${tc.border} ${tc.bg.replace('/10', '')} ${tc.text === 'text-foreground' ? 'text-foreground' : tc.text}`,
    soft: `border ${tc.border} ${tc.bg} ${tc.text}`,
    ghost: `border border-transparent bg-transparent ${tc.text} hover:bg-muted/40`,
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base.filter(Boolean).join(' ')} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <Loader2 size={isCompact ? 12 : 14} className="animate-spin" />
      ) : Icon ? (
        <Icon size={isCompact ? 12 : 14} />
      ) : null}
      {children}
      {IconAfter && <IconAfter size={isCompact ? 12 : 14} />}
    </button>
  );
}
