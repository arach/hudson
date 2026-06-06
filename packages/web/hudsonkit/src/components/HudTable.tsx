'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useResizableColumns } from '../hooks/useResizableColumns';

/**
 * Web counterpart to the Apple `HudTable` primitive (Sources/HudsonUI/Primitives/
 * HudTable.swift). Same conceptual API: items + column descriptors + optional
 * selection + density. Adds web-native affordances the native side can't have:
 * resizable columns (drag the right edge of any header) with optional
 * localStorage persistence.
 *
 * ```tsx
 * <HudTable
 *   items={agents}
 *   rowKey={(a) => a.id}
 *   selectedKey={selected}
 *   onSelect={(a) => setSelected(a.id)}
 *   storageKey="hudson:agents-table"
 *   columns={[
 *     { key: 'name',   title: 'Name',    defaultWidth: 240, sortable: true, cell: (a) => a.name },
 *     { key: 'status', title: 'Status',  defaultWidth: 120, alignment: 'center', sortValue: (a) => a.status, cell: (a) => <StatusBadge of={a} /> },
 *     { key: 'updated', title: 'Updated', defaultWidth: 120, alignment: 'trailing', sortValue: (a) => a.updatedAt, cell: (a) => a.updated },
 *   ]}
 * />
 * ```
 */

export type HudTableAlignment = 'leading' | 'center' | 'trailing';
export type HudTableDensity = 'compact' | 'regular';
export type HudTableSortDirection = 'ascending' | 'descending';
export type HudTableSortValue = string | number | boolean | Date | null | undefined;

export type HudTableSortDescriptor = {
  key: string;
  direction: HudTableSortDirection;
};

export type HudTableColumn<Item> = {
  key: string;
  title: string;
  alignment?: HudTableAlignment;
  /** Initial column width in px. Defaults to 160. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Enables header sorting. Provide for non-primitive cell renderers. */
  sortValue?: (item: Item) => HudTableSortValue;
  /** Allows sorting by primitive cell output when no sortValue is supplied. */
  sortable?: boolean;
  defaultSortDirection?: HudTableSortDirection;
  cell: (item: Item) => ReactNode;
};

export type HudTableProps<Item> = {
  items: readonly Item[];
  columns: HudTableColumn<Item>[];
  rowKey: (item: Item) => string;
  density?: HudTableDensity;
  selectedKey?: string | null;
  onSelect?: (item: Item) => void;
  defaultSortDescriptor?: HudTableSortDescriptor | null;
  sortDescriptor?: HudTableSortDescriptor | null;
  onSortChange?: (descriptor: HudTableSortDescriptor | null) => void;
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
  defaultSortDescriptor = null,
  sortDescriptor,
  onSortChange,
  storageKey,
  className = '',
}: HudTableProps<Item>) {
  const [internalSortDescriptor, setInternalSortDescriptor] = useState<HudTableSortDescriptor | null>(
    defaultSortDescriptor,
  );
  const activeSortDescriptor = sortDescriptor !== undefined ? sortDescriptor : internalSortDescriptor;

  const { getColumnProps, getResizeHandleProps } = useResizableColumns({
    storageKey,
    columns: columns.map((c) => ({
      key: c.key,
      defaultWidth: c.defaultWidth ?? 160,
      minWidth: c.minWidth,
      maxWidth: c.maxWidth,
    })),
  });

  const columnByKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const sortedItems = useMemo(() => {
    if (!activeSortDescriptor) return items;
    const column = columnByKey.get(activeSortDescriptor.key);
    if (!column || !isColumnSortable(column)) return items;
    const direction = activeSortDescriptor.direction === 'ascending' ? 1 : -1;

    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const compared = compareHudTableValues(
          hudTableSortValue(column, left.item),
          hudTableSortValue(column, right.item),
        );
        return compared === 0 ? left.index - right.index : compared * direction;
      })
      .map(({ item }) => item);
  }, [activeSortDescriptor, columnByKey, items]);

  const setSortDescriptor = (next: HudTableSortDescriptor | null) => {
    if (sortDescriptor === undefined) setInternalSortDescriptor(next);
    onSortChange?.(next);
  };

  const toggleSort = (column: HudTableColumn<Item>) => {
    if (!isColumnSortable(column)) return;
    const nextDirection = activeSortDescriptor?.key === column.key
      ? activeSortDescriptor.direction === 'ascending' ? 'descending' : 'ascending'
      : column.defaultSortDirection ?? 'ascending';
    setSortDescriptor({ key: column.key, direction: nextDirection });
  };

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
                aria-sort={activeSortDescriptor?.key === col.key ? activeSortDescriptor.direction : undefined}
              >
                {isColumnSortable(col) ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className={`inline-flex min-w-0 max-w-full items-center gap-1.5 uppercase tracking-wide transition ${
                      activeSortDescriptor?.key === col.key ? 'text-[var(--hud-accent)]' : 'hover:text-[var(--hud-ink)]'
                    } ${col.alignment === 'trailing' ? 'justify-end' : col.alignment === 'center' ? 'justify-center' : 'justify-start'}`}
                    style={{ width: 'calc(100% - 0.5rem)' }}
                  >
                    <span className="min-w-0 truncate">{col.title}</span>
                    <HudTableSortIcon
                      active={activeSortDescriptor?.key === col.key}
                      direction={activeSortDescriptor?.direction ?? col.defaultSortDirection ?? 'ascending'}
                    />
                  </button>
                ) : (
                  col.title
                )}
                <span
                  {...getResizeHandleProps(col.key)}
                  className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize select-none"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => {
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

function HudTableSortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: HudTableSortDirection;
}) {
  const Icon = !active ? ArrowUpDown : direction === 'ascending' ? ArrowUp : ArrowDown;
  return <Icon size={11} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />;
}

function isColumnSortable<Item>(column: HudTableColumn<Item>) {
  return Boolean(column.sortValue || column.sortable);
}

function hudTableSortValue<Item>(column: HudTableColumn<Item>, item: Item): HudTableSortValue | ReactNode {
  return column.sortValue ? column.sortValue(item) : column.cell(item);
}

function compareHudTableValues(left: HudTableSortValue | ReactNode, right: HudTableSortValue | ReactNode) {
  const normalizedLeft = normalizeHudTableSortValue(left);
  const normalizedRight = normalizeHudTableSortValue(right);

  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function normalizeHudTableSortValue(value: HudTableSortValue | ReactNode): string | number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}
