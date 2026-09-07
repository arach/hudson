'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { HudDensity } from './types';

export interface HudPanelSectionProps {
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  density?: HudDensity;
  children: React.ReactNode;
}

export function HudPanelSection({
  title,
  defaultOpen = true,
  actions,
  density = 'default',
  children,
}: HudPanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isCompact = density === 'compact';

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={[
          'flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors',
          'font-mono uppercase tracking-[0.16em]',
          isCompact ? 'py-1 text-[9px]' : 'py-1.5 text-[10px]',
        ].join(' ')}
      >
        <ChevronRight
          size={10}
          className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 text-left">{title}</span>
        {actions && (
          <span
            className="ml-auto flex items-center gap-1"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
      </button>
      {open && (
        <div className={`flex flex-col ${isCompact ? 'gap-1.5 pb-1.5' : 'gap-2 pb-2'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
