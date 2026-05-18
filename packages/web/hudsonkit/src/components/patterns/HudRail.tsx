'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import { HudGroupedList } from './HudGroupedList';
import type { HudGroupedListGroup } from './HudGroupedList';
import type { HudDensity, HudTone } from '../primitives';
import { HudBadge } from '../primitives';
import { cx } from './utils';

export interface HudRailItem {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  avatar?: React.ReactNode;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  status?: React.ReactNode;
  statusTone?: HudTone;
  disabled?: boolean;
}

export interface HudRailSection extends Omit<HudGroupedListGroup<HudRailItem>, 'items'> {
  items: readonly HudRailItem[];
}

export interface HudRailProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  sections: readonly HudRailSection[];
  selectedId?: string | null;
  onSelect?: (item: HudRailItem) => void;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  density?: HudDensity;
  className?: string;
  empty?: React.ReactNode;
}

export function HudRail({
  title,
  subtitle,
  sections,
  selectedId,
  onSelect,
  search,
  actions,
  footer,
  density = 'default',
  className,
  empty,
}: HudRailProps) {
  const compact = density === 'compact';

  return (
    <div className={cx('flex min-h-0 flex-col border-r border-border/70 bg-card/72', className)}>
      {(title || subtitle || actions) && (
        <div className={cx('border-b border-border/70', compact ? 'p-3' : 'p-4')}>
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              {title && <div className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/82">{title}</div>}
              {subtitle && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          </div>
        </div>
      )}

      {search && (
        <div className={cx('border-b border-border/70', compact ? 'p-2' : 'p-3')}>
          <label className="relative block">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search.value}
              onChange={event => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? 'Search...'}
              className="h-8 w-full rounded-md border border-border bg-muted/25 pl-7 pr-2 font-mono text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30"
            />
          </label>
        </div>
      )}

      <div className={cx('min-h-0 flex-1 overflow-y-auto frame-scrollbar', compact ? 'py-2' : 'py-3')}>
        <HudGroupedList
          groups={sections}
          itemKey={item => item.id}
          selectedKey={selectedId}
          onSelect={onSelect}
          density={density}
          empty={empty}
          renderTitle={item => (
            <span className={cx('flex min-w-0 items-center gap-2', item.disabled && 'text-muted-foreground')}>
              {item.avatar && <span className="shrink-0">{item.avatar}</span>}
              <span className="min-w-0 truncate">{item.title}</span>
            </span>
          )}
          renderDescription={item => item.subtitle}
          renderIcon={item => item.icon}
          itemDisabled={item => item.disabled ?? false}
          trailingBehavior="always"
          renderBadge={item => {
            if (!item.status && !item.badge) return undefined;
            return (
              <>
                {item.status && <HudBadge tone={item.statusTone ?? 'accent'} density="compact" dot>{item.status}</HudBadge>}
                {item.badge}
              </>
            );
          }}
          renderTrailing={item => item.trailing}
        />
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border/70 p-3">
          {footer}
        </div>
      )}
    </div>
  );
}
