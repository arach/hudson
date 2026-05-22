'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { HudBadge } from '../primitives';
import type { HudDensity, HudTone } from '../primitives';
import { cx } from './utils';

const toneTextClass: Record<HudTone, string> = {
  neutral: 'text-foreground/80',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export interface HudPreviewCardMetric {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: HudTone;
}

export interface HudPreviewCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: LucideIcon;
  preview?: React.ReactNode;
  media?: React.ReactNode;
  metrics?: readonly HudPreviewCardMetric[];
  status?: React.ReactNode;
  statusTone?: HudTone;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  density?: HudDensity;
  onClick?: () => void;
  className?: string;
}

export function HudPreviewCard({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  preview,
  media,
  metrics,
  status,
  statusTone = 'accent',
  actions,
  footer,
  selected,
  disabled,
  density = 'default',
  onClick,
  className,
}: HudPreviewCardProps) {
  const interactive = !!onClick && !disabled;
  const compact = density === 'compact';
  const body = (
    <>
      {(media || preview) && (
        <div className={cx(
          'relative overflow-hidden rounded-md border border-border/60 bg-muted/25',
          compact ? 'min-h-16' : 'min-h-24',
        )}>
          {media ?? preview}
        </div>
      )}

      <div className="flex min-w-0 items-start gap-2">
        {Icon && (
          <div className="mt-0.5 rounded-md border border-border/60 bg-muted/35 p-1.5 text-muted-foreground">
            <Icon size={compact ? 13 : 15} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="mb-1 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className={cx('truncate font-medium text-foreground/86', compact ? 'text-[12px]' : 'text-[13px]')}>
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {status && <HudBadge tone={statusTone} density="compact" dot>{status}</HudBadge>}
      </div>

      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
          {metrics.map((metric, index) => (
            <div key={index} className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5">
              <div className="truncate font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
                {metric.label}
              </div>
              <div className={cx(
                'mt-0.5 truncate font-mono text-[12px]',
                metric.tone ? toneTextClass[metric.tone] : 'text-foreground/80',
              )}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {(actions || footer) && (
        <div className="mt-auto flex min-w-0 items-center gap-2 border-t border-border/55 pt-2">
          {footer && <div className="min-w-0 flex-1 text-[10px] text-muted-foreground">{footer}</div>}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
    </>
  );

  const cardClassName = cx(
    'group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card/72 text-left transition-colors',
    selected ? 'border-accent/45 bg-accent/[0.07]' : 'border-border/70 hover:border-border',
    interactive && 'cursor-pointer hover:bg-muted/30',
    disabled && 'opacity-50',
    compact ? 'gap-2 p-2' : 'gap-3 p-3',
    className,
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cardClassName}>
        {body}
      </button>
    );
  }

  return (
    <div className={cardClassName}>
      {body}
    </div>
  );
}
