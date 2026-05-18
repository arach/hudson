'use client';

import React from 'react';
import type { HudDensity, HudTone } from './types';

export interface HudProgressProps {
  value: number;
  tone?: HudTone;
  density?: HudDensity;
  label?: string;
}

const fillColor: Record<HudTone, string> = {
  neutral: 'bg-muted-foreground',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export function HudProgress({
  value,
  tone = 'accent',
  density = 'default',
  label,
}: HudProgressProps) {
  const isCompact = density === 'compact';
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className={`font-mono text-muted-foreground ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            {label}
          </span>
        </div>
      )}
      <div
        className={`w-full rounded-full bg-muted/40 overflow-hidden ${isCompact ? 'h-1' : 'h-1.5'}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
