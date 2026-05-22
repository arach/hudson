'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { LogoTemplate } from './types';

const VB = 256;

interface LogoVersionCellMeta {
  key: string;
  templateId: string;
  templateName: string;
  description: string;
}

interface LogoVersionGridProps {
  templates: LogoTemplate[];
  cellSize?: number;
  selectedKeys?: ReadonlySet<string>;
  onToggleCell?: (cell: LogoVersionCellMeta) => void;
  emptyHint?: string;
}

function renderInner(renderBody: string, params: Record<string, unknown>, vb: number): string {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('p', 'vb', renderBody);
    const result = fn(params, vb);
    return typeof result === 'string' ? result : '';
  } catch {
    return `<rect width="${vb}" height="${vb}" fill="#1a1813"/><text x="${vb / 2}" y="${vb / 2}" text-anchor="middle" font-family="ui-monospace" font-size="${vb * 0.05}" fill="#8a8273">render error</text>`;
  }
}

function defaultsOf(template: LogoTemplate): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of template.params ?? []) out[p.key] = p.default;
  return out;
}

/**
 * Grid of templates rendered as cells — used for v2+ matrix sessions where
 * each cell is a previously AI-spawned variant. Cells are pickable so the
 * user can pick winners from this round and iterate again.
 */
export function LogoVersionGrid({
  templates,
  cellSize = 120,
  selectedKeys,
  onToggleCell,
  emptyHint,
}: LogoVersionGridProps) {
  const cells = useMemo(() => templates.map((t, idx) => ({
    svg: renderInner(t.renderBody, defaultsOf(t), VB),
    label: t.name,
    meta: {
      key: `v::${t.id}`,
      templateId: t.id,
      templateName: t.name,
      description: t.description ?? '',
    } satisfies LogoVersionCellMeta,
    coordLabel: String(idx + 1),
  })), [templates]);

  if (cells.length === 0) {
    return (
      <div className="logo-comparison-sheet logo-comparison-sheet--missing">
        {emptyHint ?? 'Waiting for the AI to create variants for this round…'}
      </div>
    );
  }

  const selectable = Boolean(onToggleCell);
  return (
    <div className="logo-comparison-sheet">
      <div className="logo-comparison-sheet__row">
        <div className="logo-comparison-sheet__row-cells">
          {cells.map(cell => {
            const isSelected = selectedKeys?.has(cell.meta.key) ?? false;
            const cellClass = `logo-comparison-sheet__cell${isSelected ? ' logo-comparison-sheet__cell--selected' : ''}`;
            const inner = (
              <>
                <div style={{ position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${VB} ${VB}`}
                    width={cellSize}
                    height={cellSize}
                    xmlns="http://www.w3.org/2000/svg"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: cell.svg }}
                  />
                  <span className={`logo-comparison-sheet__coord${isSelected ? ' logo-comparison-sheet__coord--selected' : ''}`} aria-hidden="true">
                    {cell.coordLabel}
                  </span>
                  {isSelected && (
                    <span className="logo-comparison-sheet__cell-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <figcaption title={cell.meta.description}>{cell.label}</figcaption>
              </>
            );
            if (selectable) {
              return (
                <button
                  key={cell.meta.key}
                  type="button"
                  className={cellClass}
                  aria-pressed={isSelected}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleCell?.(cell.meta);
                  }}
                >
                  {inner}
                </button>
              );
            }
            return (
              <figure key={cell.meta.key} className={cellClass}>
                {inner}
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { LogoVersionCellMeta };
