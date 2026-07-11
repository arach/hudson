'use client';

import React from 'react';
import type { HudsonIcon } from '../../icons';
import type { HudDensity } from './types';

export interface HudInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  density?: HudDensity;
  icon?: HudsonIcon;
  invalid?: boolean;
  className?: string;
}

export const HudInput = React.forwardRef<HTMLInputElement, HudInputProps>(
  function HudInput({ density = 'default', icon: Icon, invalid, className = '', ...rest }, ref) {
    const isCompact = density === 'compact';

    return (
      <div className="relative">
        {Icon && (
          <Icon
            size={isCompact ? 12 : 14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        )}
        <input
          ref={ref}
          {...rest}
          className={[
            'w-full rounded-md border bg-muted/40 font-mono outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
            invalid ? 'border-destructive' : 'border-border',
            isCompact ? 'px-2 py-1 text-[11px]' : 'px-2 py-1.5 text-[12px]',
            Icon && (isCompact ? 'pl-7' : 'pl-8'),
            className,
          ].filter(Boolean).join(' ')}
        />
      </div>
    );
  },
);
