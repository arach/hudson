'use client';

import React from 'react';
import type { HudDensity } from './types';

export interface HudFieldProps {
  label: string;
  description?: string;
  error?: string;
  density?: HudDensity;
  children: React.ReactNode;
}

export function HudField({
  label,
  description,
  error,
  density = 'default',
  children,
}: HudFieldProps) {
  const isCompact = density === 'compact';

  return (
    <label className={`flex flex-col ${isCompact ? 'gap-0.5' : 'gap-1'}`}>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[10px] text-destructive">{error}</span>
      ) : description ? (
        <span className="text-[10px] text-muted-foreground">{description}</span>
      ) : null}
    </label>
  );
}
