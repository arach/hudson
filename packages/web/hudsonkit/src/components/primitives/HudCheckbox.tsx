'use client';

import React from 'react';
import type { HudDensity } from './types';

export interface HudCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  density?: HudDensity;
  disabled?: boolean;
}

export function HudCheckbox({
  checked,
  onChange,
  label,
  density = 'default',
  disabled,
}: HudCheckboxProps) {
  const isCompact = density === 'compact';

  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={!label ? undefined : label}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={e => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={[
        'flex items-center justify-between cursor-pointer group',
        disabled && 'opacity-50 pointer-events-none',
      ].filter(Boolean).join(' ')}
    >
      {label && (
        <span className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} text-foreground/80 group-hover:text-foreground transition-colors`}>
          {label}
        </span>
      )}
      <div className={`relative shrink-0 rounded-full transition-colors ${
        isCompact ? 'w-7 h-4' : 'w-8 h-[18px]'
      } ${checked ? 'bg-accent' : 'bg-muted'}`}>
        <span className={`absolute top-[2px] rounded-full bg-card-foreground transition-transform ${
          isCompact ? 'w-3 h-3' : 'w-[14px] h-[14px]'
        } ${checked
          ? (isCompact ? 'translate-x-[14px]' : 'translate-x-[16px]')
          : 'translate-x-[2px]'
        }`} />
      </div>
    </div>
  );
}
