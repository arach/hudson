'use client';

import React, { useMemo } from 'react';
import { useOptionalFeatureFlags } from './provider';
import type { FeatureFlagResolution } from './types';

export interface FeatureFlagPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audienceOptions?: readonly string[];
}

export function FeatureFlagPanel({ isOpen, onClose, audienceOptions }: FeatureFlagPanelProps) {
  const flags = useOptionalFeatureFlags();
  const rows = useMemo(() => flags?.all() ?? [], [flags]);

  if (!isOpen || !flags) return null;
  const audience = flags.audience();
  const localAudience = flags.layers.local?.audience ?? '';
  const options = audienceOptions ?? inferAudienceOptions(rows, audience.tier);

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-background/45 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[78vh] w-[780px] max-w-[94vw] overflow-hidden rounded-lg border border-border bg-popover shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground">Feature Flags</div>
            <div className="mt-1 text-[11px] font-mono text-muted-foreground">Audience: <span className="text-foreground">{audience.tier}</span></div>
          </div>
          <button type="button" className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="border-b border-border px-4 py-3">
          <label className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            Local audience override
            <select
              className="rounded border border-border bg-background px-2 py-1 text-foreground"
              value={localAudience}
              onChange={event => flags.setLocalAudienceOverride(event.target.value || null)}
            >
              <option value="">Default ({audience.tier})</option>
              {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="border-b border-border px-3 py-2 font-mono">Key</th>
                <th className="border-b border-border px-3 py-2 font-mono">Value</th>
                <th className="border-b border-border px-3 py-2 font-mono">Layer</th>
                <th className="border-b border-border px-3 py-2 font-mono">Tier</th>
                <th className="border-b border-border px-3 py-2 font-mono">Local</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <div className="font-mono text-foreground">{row.key}</div>
                    <div className="text-muted-foreground">{row.definition?.label ?? row.reason}</div>
                  </td>
                  <td className={row.enabled ? 'px-3 py-2 font-mono text-emerald-500' : 'px-3 py-2 font-mono text-muted-foreground'}>{row.enabled ? 'on' : 'off'}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.layer} · {row.reason}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.requiredTier ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-border bg-background px-2 py-1 font-mono text-foreground"
                      value={localValue(flags.layers.local?.flags?.[row.key])}
                      onChange={event => {
                        const next = event.target.value;
                        flags.setLocalOverride(row.key, next === 'default' ? null : next === 'on');
                      }}
                    >
                      <option value="default">default</option>
                      <option value="on">on</option>
                      <option value="off">off</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          <span>{rows.length} flags</span>
          <button type="button" className="rounded border border-border px-2 py-1 hover:text-foreground" onClick={() => flags.resetLocalOverrides()}>Reset local overrides</button>
        </div>
      </div>
    </div>
  );
}

function localValue(value: unknown): 'default' | 'on' | 'off' {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'default';
}

function inferAudienceOptions(rows: FeatureFlagResolution[], active: string): string[] {
  const values = new Set<string>([active]);
  for (const row of rows) if (row.requiredTier) values.add(String(row.requiredTier));
  return [...values];
}
