'use client';

import React from 'react';
import type { HudsonIcon } from '../../icons';
import { HudBadge, HudPanelSection } from '../primitives';
import type { HudDensity, HudTone } from '../primitives';
import { cx } from './utils';

const toneTextClass: Record<HudTone, string> = {
  neutral: 'text-foreground/78',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export interface HudContextRow {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: HudTone;
}

export interface HudContextSection {
  id: string;
  title: string;
  rows?: readonly HudContextRow[];
  children?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}

export interface HudContextPanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: HudsonIcon;
  status?: React.ReactNode;
  statusTone?: HudTone;
  actions?: React.ReactNode;
  rows?: readonly HudContextRow[];
  sections?: readonly HudContextSection[];
  children?: React.ReactNode;
  density?: HudDensity;
  className?: string;
}

export function HudContextPanel({
  title,
  subtitle,
  icon: Icon,
  status,
  statusTone = 'accent',
  actions,
  rows,
  sections,
  children,
  density = 'default',
  className,
}: HudContextPanelProps) {
  const compact = density === 'compact';

  return (
    <aside className={cx('flex min-h-0 flex-col overflow-hidden bg-card/72', className)}>
      <div className={cx('border-b border-border/70', compact ? 'p-3' : 'p-4')}>
        <div className="flex min-w-0 items-start gap-2">
          {Icon && (
            <div className="rounded-md border border-border/60 bg-muted/35 p-1.5 text-muted-foreground">
              <Icon size={compact ? 14 : 16} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground/86">{title}</div>
            {subtitle && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {status && <HudBadge tone={statusTone} density="compact" dot>{status}</HudBadge>}
        </div>
        {actions && <div className="mt-3 flex items-center gap-1">{actions}</div>}
      </div>

      <div className={cx('min-h-0 flex-1 overflow-y-auto frame-scrollbar', compact ? 'p-3' : 'p-4')}>
        {rows && rows.length > 0 && <HudContextRows rows={rows} density={density} />}
        {children}
        {sections && sections.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {sections.map(section => (
              <HudPanelSection
                key={section.id}
                title={section.title}
                defaultOpen={section.defaultOpen}
                actions={section.actions}
                density={density}
              >
                {section.rows && <HudContextRows rows={section.rows} density={density} />}
                {section.children}
              </HudPanelSection>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function HudContextRows({ rows, density }: { rows: readonly HudContextRow[]; density: HudDensity }) {
  return (
    <dl className={cx('grid grid-cols-[minmax(72px,0.45fr)_minmax(0,1fr)]', density === 'compact' ? 'gap-x-2 gap-y-1.5 text-[10px]' : 'gap-x-3 gap-y-2 text-[11px]')}>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          <dt className="truncate font-mono uppercase tracking-[0.14em] text-muted-foreground">{row.label}</dt>
          <dd className={cx('min-w-0 truncate text-right font-mono', row.tone ? toneTextClass[row.tone] : 'text-foreground/78')}>
            {row.value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
