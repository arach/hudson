'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { HudDensity } from './types';

export interface HudSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  options: { value: string; label: string }[];
  density?: HudDensity;
  invalid?: boolean;
  className?: string;
}

export const HudSelect = React.forwardRef<HTMLSelectElement, HudSelectProps>(
  function HudSelect({ options, density = 'default', invalid, className = '', ...rest }, ref) {
    const isCompact = density === 'compact';

    return (
      <div className="relative">
        <select
          ref={ref}
          {...rest}
          className={[
            'w-full appearance-none rounded-md border bg-muted/40 font-mono outline-none transition-colors pr-7',
            'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
            invalid ? 'border-destructive' : 'border-border',
            isCompact ? 'px-2 py-1 text-[11px]' : 'px-2 py-1.5 text-[12px]',
            className,
          ].filter(Boolean).join(' ')}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={isCompact ? 12 : 14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
      </div>
    );
  },
);
