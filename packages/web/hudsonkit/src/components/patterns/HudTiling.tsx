'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cx } from './utils';

export interface TilingConstraints {
  /** Hard cap on number of columns. Defaults to auto (sqrt-ish). */
  maxColumns?: number;
  /** Hard cap on number of rows. */
  maxRows?: number;
  /** Gap between tiles in pixels. */
  gap?: number;
  /** Maximum width any single tile may occupy (px). */
  maxItemWidth?: number;
  /** Maximum height any single tile may occupy (px). */
  maxItemHeight?: number;
  /** Minimum width any single tile must have (px). */
  minItemWidth?: number;
  /** Minimum height any single tile must have (px). */
  minItemHeight?: number;
  /**
   * Fraction of the available container to actually use (0-1).
   * Useful when you want tiles to never take the full viewport
   * (e.g. 0.8 for 80%).
   */
  maxFill?: number;
  /**
   * How to distribute space.
   * - 'maximize': grow tiles as much as constraints allow to fill the space.
   * - 'even': keep uniform cells, center the block if underfilled.
   * - 'compact': pack tightly, allow last row to look different.
   */
  fillStrategy?: 'maximize' | 'even' | 'compact';
  /**
   * How to handle the last (incomplete) row.
   */
  alignLastRow?: 'start' | 'center' | 'stretch';
  /**
   * Optional heuristic to influence column count.
   * When true and no maxColumns, prefer more columns over tall grids.
   */
  preferMoreColumns?: boolean;
}

export interface HudTilingProps<Item> {
  items: readonly Item[];
  itemKey: (item: Item) => string | number;
  renderItem: (
    item: Item,
    layout: { width: number; height: number; x: number; y: number; index: number }
  ) => ReactNode;

  /** Layout constraints (all optional, great defaults are provided). */
  constraints?: TilingConstraints;

  /** Controlled order of keys. If provided, component is controlled. */
  order?: Array<string | number>;
  /** Called when user drag-reorders items. */
  onOrderChange?: (newOrder: Array<string | number>) => void;

  /** Optional fixed dimensions (great for canvas/world-space usage). */
  dimensions?: { width: number; height: number };

  className?: string;
  style?: CSSProperties;

  /** Disable drag reordering. */
  draggable?: boolean;

  /** Controlled sizes per item (key -> size). Enables resize support. */
  sizes?: Record<string | number, { width: number; height: number }>;
  /** Called when sizes change via user resize. */
  onSizesChange?: (sizes: Record<string | number, { width: number; height: number }>) => void;

  /** Show resize handles on corners when true. */
  resizable?: boolean;
}

interface TileLayout {
  key: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_GAP = 12;
const DEFAULT_FILL = 1;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Pure layout calculator.
 * Given a container and constraints, produces positions + sizes that
 * try very hard to never waste space.
 */
export function computeTilingLayout(
  keys: Array<string | number>,
  containerWidth: number,
  containerHeight: number,
  constraints: TilingConstraints = {}
): TileLayout[] {
  const n = keys.length;
  if (n === 0 || containerWidth <= 0 || containerHeight <= 0) return [];

  const gap = constraints.gap ?? DEFAULT_GAP;
  const maxCols = constraints.maxColumns ?? Infinity;
  const maxRows = constraints.maxRows ?? Infinity;
  const maxFill = constraints.maxFill ?? DEFAULT_FILL;

  const effW = containerWidth * maxFill;
  const effH = containerHeight * maxFill;

  const minW = constraints.minItemWidth ?? 120;
  const minH = constraints.minItemHeight ?? 80;
  const maxW = constraints.maxItemWidth ?? Infinity;
  const maxH = constraints.maxItemHeight ?? Infinity;

  // Decide grid shape
  // When an explicit maxColumns is given we treat it as a hard cap and use up to that many.
  // Otherwise fall back to the sqrt + preferMoreColumns heuristic.
  let cols: number;
  if (constraints.maxColumns != null) {
    cols = Math.min(constraints.maxColumns, n);
  } else {
    cols = Math.min(
      maxCols,
      Math.max(1, Math.floor(Math.sqrt(n)))
    );
    if (constraints.preferMoreColumns) {
      cols = Math.max(cols, Math.ceil(n / 2));
    }
    cols = Math.min(maxCols, cols);
  }

  let rows = Math.ceil(n / cols);
  if (rows > maxRows) {
    rows = maxRows;
    const effectiveMax = constraints.maxColumns ?? maxCols;
    cols = Math.min(effectiveMax, Math.ceil(n / rows));
  }
  cols = Math.min(cols, n);

  const totalGapW = Math.max(0, (cols - 1) * gap);
  const totalGapH = Math.max(0, (rows - 1) * gap);

  // Base cell size from effective area
  let cellW = (effW - totalGapW) / Math.max(1, cols);
  let cellH = (effH - totalGapH) / Math.max(1, rows);

  // Apply per-item caps
  cellW = clamp(cellW, minW, maxW);
  cellH = clamp(cellH, minH, maxH);

  const strategy = constraints.fillStrategy ?? 'maximize';
  const alignLast = constraints.alignLastRow ?? 'start';

  // Maximize usage of the space (distribute extra after initial caps)
  if (strategy === 'maximize') {
    const usedW = cols * cellW + totalGapW;
    const extraW = effW - usedW;
    if (extraW > 0) cellW += extraW / cols;

    const usedH = rows * cellH + totalGapH;
    const extraH = effH - usedH;
    if (extraH > 0) cellH += extraH / rows;

    cellW = clamp(cellW, minW, maxW);
    cellH = clamp(cellH, minH, maxH);
  }

  const layouts: TileLayout[] = [];
  const lastRowIndex = rows - 1;
  const itemsInLastRow = n % cols || cols;

  // Pre-compute final per-column and per-row sizes for accurate placement
  const colWidths = new Array(cols).fill(cellW);
  const rowHeights = new Array(rows).fill(cellH);

  if (strategy !== 'even' && alignLast === 'stretch' && itemsInLastRow > 0) {
    const lastRowGap = (itemsInLastRow - 1) * gap;
    const stretchedW = (effW - lastRowGap) / itemsInLastRow;
    for (let c = 0; c < itemsInLastRow; c++) {
      colWidths[c] = clamp(stretchedW, minW, maxW);
    }
  }

  // Build cumulative positions
  const colStarts: number[] = [];
  let cx = 0;
  for (let c = 0; c < cols; c++) {
    colStarts[c] = cx;
    cx += colWidths[c] + (c < cols - 1 ? gap : 0);
  }

  const rowStarts: number[] = [];
  let ry = 0;
  for (let r = 0; r < rows; r++) {
    rowStarts[r] = ry;
    ry += rowHeights[r] + (r < rows - 1 ? gap : 0);
  }

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    let w = colWidths[col];
    let h = rowHeights[row];

    let x = colStarts[col];
    let y = rowStarts[row];

    // Center last row (non-stretch)
    if (
      row === lastRowIndex &&
      alignLast === 'center' &&
      itemsInLastRow < cols
    ) {
      const lastRowTotalW = itemsInLastRow * colWidths[col] + (itemsInLastRow - 1) * gap; // use actual
      const offset = (effW - lastRowTotalW) / 2;
      x = offset + col * (w + gap);
    }

    layouts.push({
      key: keys[i],
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    });
  }

  // Optional global centering when not stretching
  if (strategy === 'even' || (strategy === 'compact' && alignLast !== 'stretch')) {
    const totalUsedW = colStarts[cols - 1] + colWidths[cols - 1];
    const totalUsedH = rowStarts[rows - 1] + rowHeights[rows - 1];
    const offX = Math.max(0, (effW - totalUsedW) / 2);
    const offY = Math.max(0, (effH - totalUsedH) / 2);

    for (const l of layouts) {
      l.x += Math.round(offX);
      l.y += Math.round(offY);
    }
  }

  return layouts;
}

export function HudTiling<Item>({
  items,
  itemKey,
  renderItem,
  constraints = {},
  order: controlledOrder,
  onOrderChange,
  dimensions,
  className,
  style,
  draggable = true,
  sizes: controlledSizes,
  onSizesChange,
  resizable = false,
}: HudTilingProps<Item>) {
  const isControlled = controlledOrder !== undefined;
  const [internalOrder, setInternalOrder] = useState<Array<string | number>>(() =>
    items.map(itemKey)
  );

  const isSizesControlled = controlledSizes !== undefined;
  const [internalSizes, setInternalSizes] = useState<Record<string | number, { width: number; height: number }>>(() => ({}));

  const currentOrder = isControlled ? controlledOrder : internalOrder;
  const currentSizes = isSizesControlled ? controlledSizes : internalSizes;

  // Internal resize state (for when not fully controlled)
  const [resizingKey, setResizingKey] = useState<string | number | null>(null);
  const resizeStartRef = useRef<{ key: string | number; pointerId: number; startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Keep internal order in sync when items change (uncontrolled)
  useEffect(() => {
    if (isControlled) return;
    const next = items.map(itemKey);
    // Only reset if the set of keys actually changed
    const currentSet = new Set(internalOrder);
    const nextSet = new Set(next);
    if (
      next.length !== internalOrder.length ||
      !next.every((k) => currentSet.has(k))
    ) {
      setInternalOrder(next);
    }
  }, [items, itemKey, isControlled]);

  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const containerSize = dimensions ?? measured ?? { width: 0, height: 0 };

  // Observe size when not using explicit dimensions (fixed-page usage)
  useEffect(() => {
    if (dimensions) return;
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setMeasured({ width: rect.width, height: rect.height });
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dimensions]);

  // Current layout
  const layout = useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) return [];
    // Reorder items according to currentOrder
    const orderedItems = [...items].sort((a, b) => {
      const ka = itemKey(a);
      const kb = itemKey(b);
      const ia = currentOrder.indexOf(ka);
      const ib = currentOrder.indexOf(kb);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const orderedKeys = orderedItems.map(itemKey);
    return computeTilingLayout(orderedKeys, containerSize.width, containerSize.height, constraints);
  }, [items, itemKey, currentOrder, containerSize.width, containerSize.height, constraints]);

  // Map key -> item for rendering
  const itemByKey = useMemo(() => {
    const map = new Map<string | number, Item>();
    for (const item of items) {
      map.set(itemKey(item), item);
    }
    return map;
  }, [items, itemKey]);

  // Drag state
  const [draggingKey, setDraggingKey] = useState<string | number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ key: string | number; pointerId: number } | null>(null);

  const reorder = useCallback(
    (newOrder: Array<string | number>) => {
      if (isControlled) {
        onOrderChange?.(newOrder);
      } else {
        setInternalOrder(newOrder);
        onOrderChange?.(newOrder);
      }
    },
    [isControlled, onOrderChange]
  );

  const handlePointerDown = useCallback(
    (key: string | number) => (e: ReactPointerEvent) => {
      if (!draggable) return;
      // Only primary button
      if (e.button !== 0) return;

      dragStartRef.current = { key, pointerId: e.pointerId };
      setDraggingKey(key);
      setDropIndex(null);

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [draggable]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      if (dragStartRef.current && draggable) {
        const { key: draggedKey } = dragStartRef.current;

        // Find which layout slot the pointer is over
        let targetIndex = layout.findIndex(
          (l) =>
            relX >= l.x &&
            relX <= l.x + l.width &&
            relY >= l.y &&
            relY <= l.y + l.height
        );

        if (targetIndex === -1) {
          // Check proximity to edges for insertion between
          targetIndex = layout.length - 1;
        }

        // Convert layout index to order index
        const draggedCurrentIdx = currentOrder.indexOf(draggedKey);
        if (targetIndex !== draggedCurrentIdx && targetIndex >= 0) {
          setDropIndex(targetIndex);
        }
      }

    },
    [draggable, layout, currentOrder]
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragStartRef.current;
      if (!drag) return;

      const { key: draggedKey, pointerId } = drag;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(pointerId);
      } catch {}

      if (dropIndex != null && dropIndex !== currentOrder.indexOf(draggedKey)) {
        const newOrder = [...currentOrder];
        const from = newOrder.indexOf(draggedKey);
        if (from !== -1) {
          const [moved] = newOrder.splice(from, 1);
          // Insert at drop location, adjusting if we removed before it
          let insertAt = dropIndex;
          if (from < dropIndex) insertAt--;
          newOrder.splice(Math.max(0, insertAt), 0, moved);
          reorder(newOrder);
        }
      }

      setDraggingKey(null);
      setDropIndex(null);
      dragStartRef.current = null;
    },
    [currentOrder, dropIndex, reorder]
  );

  const handlePointerUp = finishDrag;
  const handlePointerCancel = finishDrag;

  // Simple resize support when resizable
  const handleResizePointerDown = useCallback((key: string | number) => (e: ReactPointerEvent) => {
    if (!resizable) return;
    const baseSize = currentSizes?.[key] ?? layout.find(l => l.key === key) ?? {width: 100, height: 60};
    resizeStartRef.current = {
      key,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: baseSize.width,
      startH: baseSize.height,
    };
    setResizingKey(key);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }, [resizable, currentSizes, layout]);

  const handleResizeMove = useCallback((e: ReactPointerEvent) => {
    const ref = resizeStartRef.current;
    if (!ref || !resizable) return;
    const { key, startX, startY, startW, startH } = ref;
    const dw = e.clientX - startX;
    const dh = e.clientY - startY;
    const newW = Math.max(60, Math.round(startW + dw));
    const newH = Math.max(40, Math.round(startH + dh));
    const next = { ...(currentSizes || {}), [key]: { width: newW, height: newH } };
    if (isSizesControlled) {
      onSizesChange?.(next);
    } else {
      setInternalSizes(next);
    }
  }, [resizable, currentSizes, isSizesControlled, onSizesChange]);

  const finishResize = useCallback((e: ReactPointerEvent) => {
    const ref = resizeStartRef.current;
    if (!ref) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(ref.pointerId); } catch {}
    resizeStartRef.current = null;
    setResizingKey(null);
  }, []);

  // Render
  const hasSize = containerSize.width > 0 && containerSize.height > 0;

  return (
    <div
      ref={containerRef}
      className={cx(
        'relative overflow-hidden select-none',
        hasSize ? '' : 'min-h-[120px] min-w-[200px]',
        className
      )}
      style={{
        width: dimensions ? dimensions.width : undefined,
        height: dimensions ? dimensions.height : '100%',
        ...style,
      }}
      onPointerMove={(draggingKey || resizingKey) ? (draggingKey ? handlePointerMove : handleResizeMove) : undefined}
    >
      {!hasSize && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          sizing…
        </div>
      )}

      {layout.map((tile, index) => {
        const item = itemByKey.get(tile.key);
        if (!item) return null;

        const isDraggingThis = draggingKey === tile.key;
        const isDropTarget = dropIndex === index;

        const itemSize = currentSizes?.[tile.key] ?? { width: tile.width, height: tile.height };

        return (
          <div
            key={tile.key}
            className={cx(
              'absolute overflow-hidden rounded border border-border/60 bg-card transition-[box-shadow,transform] duration-100',
              isDraggingThis && 'z-50 shadow-2xl ring-1 ring-ring scale-[1.01]',
              isDropTarget && 'ring-2 ring-accent'
            )}
            style={{
              left: tile.x,
              top: tile.y,
              width: itemSize.width,
              height: itemSize.height,
              pointerEvents: isDraggingThis ? 'none' : 'auto',
            }}
            onPointerDown={draggable ? handlePointerDown(tile.key) : undefined}
            onPointerUp={draggingKey || resizingKey ? (draggingKey ? handlePointerUp : finishResize) : undefined}
            onPointerCancel={draggingKey || resizingKey ? (draggingKey ? handlePointerCancel : finishResize) : undefined}
          >
            {renderItem(item, {
              width: itemSize.width,
              height: itemSize.height,
              x: tile.x,
              y: tile.y,
              index,
            })}

            {resizable && !isDraggingThis && (
              <div
                className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-foreground/30 hover:bg-foreground/50 rounded-tl"
                onPointerDown={handleResizePointerDown(tile.key)}
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
        );
      })}

      {/* Subtle grid hint when dragging (optional visual affordance) */}
      {draggingKey && layout.length > 1 && (
        <div className="pointer-events-none absolute inset-0 opacity-30" />
      )}
    </div>
  );
}

export type { TileLayout };
