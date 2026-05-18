'use client';

import React from 'react';
import type { HudDensity } from './types';

export interface HudTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  density?: HudDensity;
  invalid?: boolean;
  className?: string;
}

export const HudTextarea = React.forwardRef<HTMLTextAreaElement, HudTextareaProps>(
  function HudTextarea({ density = 'default', invalid, className = '', ...rest }, ref) {
    const isCompact = density === 'compact';

    return (
      <textarea
        ref={ref}
        {...rest}
        className={[
          'w-full resize-none rounded-md border bg-muted/40 font-mono outline-none transition-colors',
          'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
          invalid ? 'border-destructive' : 'border-border',
          isCompact ? 'px-2 py-1 text-[11px]' : 'px-2 py-1.5 text-[12px]',
          className,
        ].filter(Boolean).join(' ')}
      />
    );
  },
);
