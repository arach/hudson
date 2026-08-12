'use client';

import React from 'react';
import { ChevronRight } from '../../icons';
import { cx } from '../patterns/utils';

export interface HudBreadcrumbItem {
  id: string;
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** Current page — not interactive. */
  current?: boolean;
}

export interface HudBreadcrumbProps {
  items: readonly HudBreadcrumbItem[];
  /** Accessible name for the nav landmark. @default "Breadcrumb" */
  ariaLabel?: string;
  className?: string;
  /** Separator between items. Defaults to a chevron. */
  separator?: React.ReactNode;
}

/**
 * Minimal breadcrumb chrome for panel apps (docs, settings stacks).
 * No routing assumed — consumers pass `href` or `onClick`.
 *
 * HUD-014 A5 — land minimal; grow only with a second consumer.
 */
export function HudBreadcrumb({
  items,
  ariaLabel = 'Breadcrumb',
  className = '',
  separator,
}: HudBreadcrumbProps) {
  if (items.length === 0) return null;

  const sep =
    separator ?? (
      <ChevronRight
        size={12}
        className="shrink-0 text-muted-foreground/70"
        aria-hidden="true"
      />
    );

  return (
    <nav aria-label={ariaLabel} className={cx('flex min-w-0 items-center', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px] tracking-wide">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.current ?? isLast;
          return (
            <li key={item.id} className="flex min-w-0 items-center gap-1">
              {index > 0 && <span className="flex shrink-0 items-center">{sep}</span>}
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="min-w-0 truncate font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : item.href != null ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="min-w-0 truncate border-0 bg-transparent p-0 font-mono text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
