'use client';

import React from 'react';
import type { HudDensity } from '../primitives';
import { HudPreviewCard } from './HudPreviewCard';
import type { HudPreviewCardProps } from './HudPreviewCard';
import { cx } from './utils';

export interface HudCardGridProps<Item> {
  items: readonly Item[];
  itemKey: (item: Item) => string;
  selectedKey?: string | null;
  onSelect?: (item: Item) => void;
  renderCard?: (item: Item, state: { selected: boolean }) => React.ReactNode;
  getCardProps?: (item: Item) => Omit<HudPreviewCardProps, 'selected' | 'onClick'>;
  density?: HudDensity;
  minCardWidth?: number;
  empty?: React.ReactNode;
  className?: string;
}

export function HudCardGrid<Item>({
  items,
  itemKey,
  selectedKey,
  onSelect,
  renderCard,
  getCardProps,
  density = 'default',
  minCardWidth = 180,
  empty,
  className,
}: HudCardGridProps<Item>) {
  if (items.length === 0 && empty) {
    return <div className={cx('px-3 py-4 text-[11px] text-muted-foreground', className)}>{empty}</div>;
  }

  return (
    <div
      className={cx('grid', density === 'compact' ? 'gap-2' : 'gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))` }}
    >
      {items.map(item => {
        const key = itemKey(item);
        const selected = selectedKey === key;
        if (renderCard) {
          return <React.Fragment key={key}>{renderCard(item, { selected })}</React.Fragment>;
        }
        if (!getCardProps) return null;
        return (
          <HudPreviewCard
            key={key}
            {...getCardProps(item)}
            selected={selected}
            density={density}
            onClick={onSelect ? () => onSelect(item) : undefined}
          />
        );
      })}
    </div>
  );
}
