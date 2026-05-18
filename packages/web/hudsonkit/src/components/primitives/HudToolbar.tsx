'use client';

import React from 'react';
import type { HudDensity } from './types';

export interface HudToolbarProps {
  children: React.ReactNode;
  density?: HudDensity;
  className?: string;
}

export function HudToolbar({
  children,
  density = 'default',
  className = '',
}: HudToolbarProps) {
  const isCompact = density === 'compact';

  return (
    <div
      role="toolbar"
      className={`flex items-center ${isCompact ? 'gap-0.5' : 'gap-1'} ${className}`}
    >
      {children}
    </div>
  );
}

export function HudToolbarSeparator() {
  return <div className="w-px h-4 bg-border/50 mx-1" />;
}
