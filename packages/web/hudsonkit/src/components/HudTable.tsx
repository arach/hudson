'use client';

import { type ReactNode } from 'react';
import { useResizableColumns } from '../hooks/useResizableColumns';

/**
 * Web counterpart to the Apple `HudTable` primitive (Sources/HudsonUI/Primitives/
 * HudTable.swift). Same conceptual API: items + column descriptors + optional
 * selection + density. Adds web-native affordances the native side can't have:
 * resizable columns (drag the right edge of any header) with optional
 * localStorage persistence.
 *
 * Resize plumbing is harvested from OpenScout's `Atop` screen
 * (packages/web/client/components/ResizableTable/useResizableColumns.ts) —
 * already battle-tested.
 *
 * ```tsx
 * <HudTable
 *   items={agents}
 *   rowKey={(a) => a.id}
 *   selectedKey={selected}
 *   onSelect={(a) => setSelected(a.id)}
 *   storageKey="hudson:agents-table"
 *   columns={[
 *     { key: 'name',   title: 'Name',    defaultWidth: 240, cell: (a) => a.name },
 *     { key: 'status', title: 'Status',  defaultWidth: 120, alignment: 'center', cell: (a) => <StatusBadge of={a} /> },
 *     { key: 'updated', title: 'Updated', defaultWidth: 120, alignment: 'trailing', cell: (a) => a.updated },
 *   ]}
 * />
 * ```
 */

export type HudTableAlignment = 'leading' | 'center' | 'trailing';
export type HudTableDensity = 'compact' | 'regular';

export type HudTableColumn<Item> = {
  key: string;
  title: string;
  alignment?: HudTableAlignment;
  /** Initial column width in px. Defaults to 160. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  cell: (item: Item) => ReactNode;
};

export type HudTableProps<Item> = {
  items: readonly Item[];
  columns: HudTableColumn<Item>[];
  rowKey: (item: Item) => string;
  density?: HudTableDensity;
  selectedKey?: string | null;
  onSelect?: (item: Item) => void;
  /** Persist column widths to localStorage under this key. */
  storageKey?: string;
  className?: string;
};

const ALIGN_CLASS: Record<HudTableAlignment, string> = {
  leading: 'text-left',
  center: 'text-center',
  trailing: 'text-right',
};

const ROW_HEIGHT_CLASS: Record<HudTableDensity, string> = {
  compact: 'h-7',
  regular: 'h-11',
};

export function HudTable<Item>({
  items,
  columns,
  rowKey,
  density = 'regular',
  selectedKey,
  onSelect,
  storageKey,
  className = '',
}: HudTableProps<Item>) {
  const { getColumnProps, getResizeHandleProps } = useResizableColumns({
    storageKey,
    columns: columns.map((c) => ({
      key: c.key,
      defaultWidth: c.defaultWidth ?? 160,
      minWidth: c.minWidth,
      maxWidth: c.maxWidth,
    })),
  });

  return (
    <div
      className={`overflow-auto rounded-md border bg-[var(--hud-surface)] ${className}`}
      style={{ borderColor: 'var(--hud-border)' }}
    >
      <table className="border-collapse" style={{ tableLayout: 'fixed', borderColor: 'var(--hud-border)' }}>
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--hud-border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                {...getColumnProps(col.key)}
                className={`relative px-3 py-1.5 font-mono text-[10px] tracking-wide uppercase ${ALIGN_CLASS[col.alignment ?? 'leading']}`}
                style={{ ...getColumnProps(col.key).style, color: 'var(--hud-dim)' }}
              >
                {col.title}
                <span
                  {...getResizeHandleProps(col.key)}
                  className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize select-none"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const k = rowKey(item);
            const isSelected = selectedKey === k;
            return (
              <tr
                key={k}
                onClick={() => onSelect?.(item)}
                className={`border-b last:border-b-0 ${ROW_HEIGHT_CLASS[density]} ${onSelect ? 'cursor-pointer' : ''}`}
                style={{
                  borderColor: 'var(--hud-border)',
                  backgroundColor: isSelected ? 'var(--hud-accent-soft)' : undefined,
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 text-sm ${ALIGN_CLASS[col.alignment ?? 'leading']}`}
                    style={{ color: 'var(--hud-ink)' }}
                  >
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
