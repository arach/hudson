'use client';

import React, { useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// ParamSection — collapsible group
// ---------------------------------------------------------------------------

export interface ParamSectionProps {
  label: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function ParamSection({ label, defaultExpanded = true, children }: ParamSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 py-1.5 text-[10px] uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors"
      >
        <ChevronRight
          size={10}
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        {label}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParamSlider
// ---------------------------------------------------------------------------

export interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

export function ParamSlider({ label, value, min, max, step, onChange, format }: ParamSliderProps) {
  const display = format ? format(value) : String(value);
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] font-mono text-white/30">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 h-1"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// ParamToggle — inline: label left, switch right
// ---------------------------------------------------------------------------

export interface ParamToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function ParamToggle({ label, value, onChange }: ParamToggleProps) {
  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!value); } }}
      className="flex items-center justify-between cursor-pointer group"
    >
      <span className="text-[11px] text-white/50 group-hover:text-white/70 transition-colors">{label}</span>
      <div className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
        value ? 'bg-emerald-500/60' : 'bg-white/10'
      }`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
          value ? 'translate-x-[16px]' : 'translate-x-[2px]'
        }`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParamColor
// ---------------------------------------------------------------------------

export interface ParamColorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ParamColor({ label, value, onChange }: ParamColorProps) {
  const isRgba = value.startsWith('rgba');
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/50">{label}</span>
      {isRgba ? (
        <span className="text-[10px] font-mono text-white/25 truncate max-w-[120px]">{value}</span>
      ) : (
        <div className="flex items-center gap-1.5">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent" />
          <span className="text-[10px] font-mono text-white/30">{value}</span>
        </div>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// ParamEnum
// ---------------------------------------------------------------------------

export interface ParamEnumProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

export function ParamEnum({ label, value, options, onChange }: ParamEnumProps) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/50">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-[11px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/70 outline-none"
      >
        {options.map((opt, i) => {
          const val = typeof opt === 'object' ? JSON.stringify(opt) : String(opt);
          return <option key={val + i} value={val}>{val}</option>;
        })}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ParamText
// ---------------------------------------------------------------------------

export interface ParamTextProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}

export function ParamText({ label, value, placeholder, onChange }: ParamTextProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-white/50">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-emerald-500/40 transition-colors"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// ParamRepeatable
// ---------------------------------------------------------------------------

export interface ParamRepeatableField {
  key: string;
  label: string;
  type: 'number' | 'color' | 'toggle' | 'enum' | 'text';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
}

export interface ParamRepeatableProps {
  label: string;
  value: Record<string, unknown>[];
  itemFields?: ParamRepeatableField[];
  itemTemplate?: Record<string, unknown>;
  onChange: (v: Record<string, unknown>[]) => void;
}

export function ParamRepeatable({ label, value, itemFields, itemTemplate, onChange }: ParamRepeatableProps) {
  const items = Array.isArray(value) ? value : [];
  const template = itemTemplate ?? {};
  const fields = itemFields ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <button
          onClick={() => onChange([...items, { ...template }])}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          + Add
        </button>
      </div>
      {items.length === 0 && (
        <div className="text-[10px] text-white/20 text-center py-2 border border-dashed border-white/8 rounded">
          No items
        </div>
      )}
      {items.map((item, index) => (
        <div key={index} className="rounded border border-white/8 bg-white/[0.02] p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-white/25 uppercase">#{index + 1}</span>
            <button
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="px-1 py-0.5 rounded text-[9px] text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              ✕
            </button>
          </div>
          {fields.map(field => {
            const fieldVal = item[field.key] ?? field.default;
            return (
              <ParamFieldRenderer
                key={field.key}
                field={field}
                value={fieldVal}
                onChange={v => {
                  const next = items.map((it, i) => i === index ? { ...it, [field.key]: v } : it);
                  onChange(next);
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParamFieldRenderer — renders a single field by type
// ---------------------------------------------------------------------------

function ParamFieldRenderer({ field, value, onChange }: {
  field: ParamRepeatableField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'number':
      return (
        <ParamSlider
          label={field.label}
          value={value as number}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          onChange={onChange}
        />
      );
    case 'color':
      return <ParamColor label={field.label} value={value as string} onChange={v => onChange(v)} />;
    case 'toggle':
      return <ParamToggle label={field.label} value={Boolean(value)} onChange={v => onChange(v)} />;
    case 'enum':
      return <ParamEnum label={field.label} value={String(value)} options={field.options ?? []} onChange={v => onChange(v)} />;
    case 'text':
      return <ParamText label={field.label} value={String(value ?? '')} placeholder={field.placeholder} onChange={v => onChange(v)} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// ParamGrid — auto-renders a param definition array, grouped by `group`
// ---------------------------------------------------------------------------

export interface ParamDefinition {
  key: string;
  label: string;
  type: 'number' | 'color' | 'toggle' | 'enum' | 'text' | 'repeatable';
  default: number | string | boolean | Record<string, unknown>[];
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
  group?: string;
  itemTemplate?: Record<string, unknown>;
  itemFields?: ParamRepeatableField[];
}

export interface ParamGridProps {
  params: ParamDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** If true, ungrouped params render flat without a section wrapper */
  flatUngrouped?: boolean;
  /** Default expanded state for sections */
  defaultExpanded?: boolean;
}

export function ParamGrid({ params, values, onChange, flatUngrouped = true, defaultExpanded = true }: ParamGridProps) {
  // Group params by group field
  const groups = new Map<string | null, ParamDefinition[]>();
  for (const p of params) {
    const g = p.group ?? null;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }

  const renderParam = useCallback((p: ParamDefinition) => {
    const val = values[p.key] ?? p.default;
    switch (p.type) {
      case 'number': {
        const pMin = p.min ?? 0;
        const pMax = p.max ?? 100;
        const pStep = p.step ?? ((pMax - pMin) < 10 ? 0.01 : 1);
        return (
          <ParamSlider key={p.key} label={p.label} value={val as number}
            min={pMin} max={pMax} step={pStep}
            onChange={v => onChange(p.key, v)} />
        );
      }
      case 'color':
        return <ParamColor key={p.key} label={p.label} value={val as string} onChange={v => onChange(p.key, v)} />;
      case 'toggle':
        return <ParamToggle key={p.key} label={p.label} value={Boolean(val)} onChange={v => onChange(p.key, v)} />;
      case 'enum':
        return <ParamEnum key={p.key} label={p.label} value={String(val)} options={p.options ?? []} onChange={v => onChange(p.key, v)} />;
      case 'text':
        return <ParamText key={p.key} label={p.label} value={String(val ?? '')} placeholder={p.placeholder} onChange={v => onChange(p.key, v)} />;
      case 'repeatable': {
        const items = Array.isArray(val) ? val : (Array.isArray(p.default) ? p.default : []);
        return (
          <ParamRepeatable key={p.key} label={p.label}
            value={items as Record<string, unknown>[]}
            itemFields={p.itemFields}
            itemTemplate={p.itemTemplate}
            onChange={v => onChange(p.key, v)} />
        );
      }
      default:
        return null;
    }
  }, [values, onChange]);

  const entries = Array.from(groups.entries());

  return (
    <div className="flex flex-col gap-1">
      {entries.map(([group, defs]) => {
        if (group === null && flatUngrouped) {
          return <div key="__ungrouped" className="flex flex-col gap-2">{defs.map(renderParam)}</div>;
        }
        return (
          <ParamSection key={group ?? '__ungrouped'} label={group ?? 'General'} defaultExpanded={defaultExpanded}>
            {defs.map(renderParam)}
          </ParamSection>
        );
      })}
    </div>
  );
}
