'use client';

import React from 'react';
import type { HudsonIcon } from '../../icons';
import { HudBadge, HudListItem } from '../primitives';
import type { HudDensity, HudTone } from '../primitives';
import { cx } from './utils';

export interface HudGroupedListGroup<Item> {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  count?: number;
  tone?: HudTone;
  items: readonly Item[];
  empty?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface HudGroupedListProps<Item> {
  renderItem?: (item: Item) => React.ReactNode;
  groupClassName?: (group: HudGroupedListGroup<Item>) => string;
  stickyHeaders?: boolean;
  groups: readonly HudGroupedListGroup<Item>[];
  itemKey: (item: Item) => string;
  selectedKey?: string | null;
  onSelect?: (item: Item) => void;
  renderTitle: (item: Item) => React.ReactNode;
  renderDescription?: (item: Item) => React.ReactNode;
  renderTrailing?: (item: Item) => React.ReactNode;
  renderIcon?: (item: Item) => HudsonIcon | undefined;
  renderBadge?: (item: Item) => React.ReactNode;
  itemDisabled?: (item: Item) => boolean;
  trailingBehavior?: 'hover' | 'always';
  density?: HudDensity;
  empty?: React.ReactNode;
  className?: string;
}

export function HudGroupedList<Item>({
  groups,
  renderItem, groupClassName, stickyHeaders,
  itemKey,
  selectedKey,
  onSelect,
  renderTitle,
  renderDescription,
  renderTrailing,
  renderIcon,
  renderBadge,
  itemDisabled,
  trailingBehavior = 'always',
  density = 'default',
  empty,
  className,
}: HudGroupedListProps<Item>) {
  const hasItems = groups.some(group => group.items.length > 0);

  if (!hasItems && empty) {
    return <div className={cx('py-2', className)}>{empty}</div>;
  }

  return (
    <div className={cx('flex flex-col', density === 'compact' ? 'gap-2' : 'gap-3', className)}>
      {groups.map(group => (
        <section key={group.id} role="group" aria-label={typeof group.title === 'string' ? group.title : undefined} className={cx("min-w-0", groupClassName?.(group))}>
          <div className={cx(
            'flex items-center gap-2 px-3 font-mono uppercase text-muted-foreground',
            stickyHeaders && group.items.length > 0 && 'sticky top-0 z-10 bg-secondary py-1',
            density === 'compact' ? 'pb-1 text-[9px] tracking-[0.14em]' : 'pb-1.5 text-[10px] tracking-[0.16em]',
          )}>
            <span className="min-w-0 truncate">{group.title}</span>
            {group.description && (
              <span className="min-w-0 truncate text-muted-foreground/70 normal-case tracking-normal">
                {group.description}
              </span>
            )}
            <span className="flex-1" />
            {typeof group.count === 'number' && (
              <HudBadge tone={group.tone ?? 'neutral'} density="compact">
                {group.count}
              </HudBadge>
            )}
            {group.actions}
          </div>

          {group.items.length === 0 ? (
            group.empty ? (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">{group.empty}</div>
            ) : null
          ) : (
            <div className="flex flex-col">
              {group.items.map(item => {
                const key = itemKey(item);
                if (renderItem) return <React.Fragment key={key}>{renderItem(item)}</React.Fragment>;
                const badge = renderBadge?.(item);
                const trailing = renderTrailing?.(item);
                return (
                  <HudListItem
                    key={key}
                    selected={selectedKey === key}
                    disabled={itemDisabled?.(item)}
                    icon={renderIcon?.(item)}
                    description={renderDescription?.(item)}
                    trailing={(badge || trailing) ? <>{badge}{trailing}</> : undefined}
                    trailingBehavior={trailingBehavior}
                    density={density}
                    onClick={onSelect ? () => onSelect(item) : undefined}
                  >
                    {renderTitle(item)}
                  </HudListItem>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
