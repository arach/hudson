'use client';

import React from 'react';
import type { HudDensity, HudTone } from './types';
import { toneClasses } from './types';

export interface HudBadgeProps {
  children: React.ReactNode;
  tone?: HudTone;
  density?: HudDensity;
  dot?: boolean;
}

export function HudBadge({
  children,
  tone = 'accent',
  density = 'default',
  dot,
}: HudBadgeProps) {
  const isCompact = density === 'compact';
  const tc = toneClasses[tone];

  return (
    <span className={[
      'inline-flex items-center gap-1 rounded-full border font-mono uppercase',
      tc.border, tc.bg, tc.text,
      isCompact
        ? 'px-1.5 py-0 text-[8px] tracking-[0.1em]'
        : 'px-2 py-0.5 text-[9px] tracking-[0.12em]',
    ].join(' ')}>
      {dot && (
        <span className={`inline-block rounded-full ${isCompact ? 'w-1 h-1' : 'w-1.5 h-1.5'} ${
          tone === 'neutral' ? 'bg-muted-foreground' : 'bg-current'
        }`} />
      )}
      {children}
    </span>
  );
}
