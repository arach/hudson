'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { builtinRenderBodies, type BuiltinDef } from './builtinRenderBodies';
import type { LogoTemplate } from './types';

type ParamValue = string | number | boolean;

export interface LogoComparisonFamily {
  label: string;
  /** Which template param to sweep across this row. */
  paramKey: string;
  /** Values along the sweep axis. Row width = values.length. */
  values: ParamValue[];
  /** Optional per-cell label override (defaults to stringified value). */
  cellLabels?: string[];
  /** Additional fixed param overrides for this row only. */
  overrides?: Record<string, ParamValue>;
  /** Optional caption line shown under the row. */
  caption?: string;
}

export interface LogoComparisonCellMeta {
  key: string;
  family: string;
  paramKey: string;
  value: ParamValue;
  overrides: Record<string, ParamValue>;
  resolvedParams: Record<string, ParamValue>;
  /** 0-based row index (family index). */
  row: number;
  /** 0-based column index within the row. */
  col: number;
  /** Human-facing coord label, e.g. "3-e" (1-based row, a-z col). */
  coordLabel: string;
}

export interface LogoComparisonSheetProps {
  templateId: string;
  template?: Pick<LogoTemplate, 'renderBody' | 'params'> | null;
  baseParams?: Record<string, ParamValue>;
  families: LogoComparisonFamily[];
  cellSize?: number;
  vb?: number;
  /** Cell keys currently picked (highlighted). */
  selectedKeys?: ReadonlySet<string>;
  /** Called when a cell is clicked. Caller toggles selection. */
  onToggleCell?: (cell: LogoComparisonCellMeta) => void;
}

const VB = 512;

type MatrixTemplateDef = Pick<BuiltinDef, 'renderBody' | 'params'> | Pick<LogoTemplate, 'renderBody' | 'params'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toParamValue(value: unknown): ParamValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function resolveDefaults(def: MatrixTemplateDef): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  const params = def.params;
  if (!params) return out;
  if (Array.isArray(params)) {
    for (const decl of params) {
      const value = toParamValue(decl.default);
      if (value !== undefined) out[decl.key] = value;
    }
    return out;
  }
  for (const [key, decl] of Object.entries(params)) {
    if (!isRecord(decl)) continue;
    const value = toParamValue(decl.default);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function renderCell(renderBody: string, params: Record<string, unknown>, vb: number): string {
  try {
    const fn = new Function('p', 'vb', renderBody);
    const result = fn(params, vb);
    return typeof result === 'string' ? result : '';
  } catch {
    return `<rect width="${vb}" height="${vb}" fill="#1a1813"/><text x="${vb / 2}" y="${vb / 2}" text-anchor="middle" font-family="ui-monospace" font-size="${vb * 0.05}" fill="#8a8273">render error</text>`;
  }
}

export function LogoComparisonSheet({
  templateId,
  template,
  baseParams,
  families,
  cellSize = 128,
  vb = VB,
  selectedKeys,
  onToggleCell,
}: LogoComparisonSheetProps) {
  const def = template?.renderBody ? template : builtinRenderBodies[templateId];

  const rows = useMemo(() => {
    if (!def) return [];
    const defaults = resolveDefaults(def);
    return families.map((family, rowIdx) => {
      const cells: { svg: string; label: string; meta: LogoComparisonCellMeta }[] = family.values.map((value, idx) => {
        const merged: Record<string, ParamValue> = {
          ...defaults,
          ...(baseParams ?? {}),
          ...(family.overrides ?? {}),
          [family.paramKey]: value,
        };
        const svg = renderCell(def.renderBody, merged, vb);
        const label = family.cellLabels?.[idx] ?? String(value);
        const key = `${family.label}::${family.paramKey}::${idx}`;
        const coordLabel = `${rowIdx + 1}-${String.fromCharCode(97 + idx)}`;
        return {
          svg,
          label,
          meta: {
            key,
            family: family.label,
            paramKey: family.paramKey,
            value,
            overrides: { ...(family.overrides ?? {}), [family.paramKey]: value },
            resolvedParams: merged,
            row: rowIdx,
            col: idx,
            coordLabel,
          },
        };
      });
      return { family, cells };
    });
  }, [def, families, baseParams, vb]);

  if (!def) {
    return (
      <div className="logo-comparison-sheet logo-comparison-sheet--missing">
        Template <code>{templateId}</code> not found in built-in registry.
      </div>
    );
  }

  const selectable = Boolean(onToggleCell);

  return (
    <div className="logo-comparison-sheet" data-template-id={templateId}>
      {rows.map(({ family, cells }) => (
        <div className="logo-comparison-sheet__row" key={family.label}>
          <div className="logo-comparison-sheet__row-label">
            <div className="logo-comparison-sheet__row-title">{family.label}</div>
            <div className="logo-comparison-sheet__row-param">
              <span>param</span>
              <code>{family.paramKey}</code>
            </div>
            {family.caption && (
              <p className="logo-comparison-sheet__row-caption">{family.caption}</p>
            )}
          </div>
          <div className="logo-comparison-sheet__row-cells">
            {cells.map(cell => {
              const isSelected = selectedKeys?.has(cell.meta.key) ?? false;
              const cellClass = `logo-comparison-sheet__cell${isSelected ? ' logo-comparison-sheet__cell--selected' : ''}`;
              const inner = (
                <>
                  <div style={{ position: 'relative' }}>
                    <svg
                      viewBox={`0 0 ${vb} ${vb}`}
                      width={cellSize}
                      height={cellSize}
                      xmlns="http://www.w3.org/2000/svg"
                      suppressHydrationWarning
                      dangerouslySetInnerHTML={{ __html: cell.svg }}
                    />
                    <span
                      className={`logo-comparison-sheet__coord${isSelected ? ' logo-comparison-sheet__coord--selected' : ''}`}
                      aria-hidden="true"
                    >
                      {cell.meta.coordLabel}
                    </span>
                    {isSelected && (
                      <span className="logo-comparison-sheet__cell-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <figcaption>{cell.label}</figcaption>
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
      ))}
    </div>
  );
}
