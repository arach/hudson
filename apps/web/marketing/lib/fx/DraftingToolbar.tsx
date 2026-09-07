'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { useFx, type FxState } from './FxContext';

type ToolDef = {
  id: keyof FxState;
  label: string;
  hint: string;
  icon: ReactNode;
};

const TOOLS: ToolDef[] = [
  {
    id: 'lens',
    label: 'Monocle',
    hint: 'magnifying lens',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" />
        <line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" />
      </svg>
    ),
  },
  {
    id: 'caliper',
    label: 'Caliper',
    hint: 'hover · click to pin',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <line x1="2" y1="2" x2="2" y2="12" stroke="currentColor" />
        <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" />
        <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" />
        <line x1="0" y1="2" x2="4" y2="2" stroke="currentColor" />
        <line x1="10" y1="2" x2="14" y2="2" stroke="currentColor" />
      </svg>
    ),
  },
  {
    id: 'cursor',
    label: 'Crosshair',
    hint: 'grid coords',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" />
        <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" />
        <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" />
      </svg>
    ),
  },
  {
    id: 'plotter',
    label: 'Plotter',
    hint: 'cnc pen reveals',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" />
        <rect x="5" y="5" width="4" height="4" fill="currentColor" />
        <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeDasharray="1 1" />
      </svg>
    ),
  },
];

export function DraftingToolbar() {
  const { fx, setFx } = useFx();
  const [open, setOpen] = useState(false);

  return (
    <div
      data-fx-overlay
      style={{
        position: 'fixed',
        right: 32,
        top: 196,
        zIndex: 100,
        width: 232,
        background: 'var(--paper)',
        border: '1.5px solid var(--ink)',
        boxShadow: '0 4px 0 var(--paper-edge)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 10px',
          background: 'var(--ink)',
          color: 'var(--paper)',
          border: 0,
          fontFamily: 'inherit',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span>⌗ Drafting Tools</span>
        <span style={{ fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div>
          {TOOLS.map((t) => {
            const active = !!fx[t.id];
            return (
              <Fragment key={t.id}>
                <button
                  onClick={() => setFx((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                  title={`${t.label} — ${t.hint}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    background: active ? 'var(--ink)' : 'var(--paper)',
                    color: active ? 'var(--paper)' : 'var(--ink-1)',
                    border: 0,
                    borderTop: '1px solid var(--line-strong)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 16, height: 16 }}>{t.icon}</span>
                  <span style={{ flex: 1 }}>{t.label}</span>
                  <span style={{ opacity: 0.7, fontSize: 9 }}>{active ? 'ON' : 'OFF'}</span>
                </button>
                {t.id === 'lens' && fx.lens && (
                  <SliderRow
                    label="Zoom"
                    value={fx.lensZoom}
                    min={1.5}
                    max={4}
                    step={0.1}
                    onChange={(v) => setFx({ lensZoom: v })}
                    format={(v) => `× ${v.toFixed(1)}`}
                  />
                )}
                {t.id === 'plotter' && fx.plotter && (
                  <Fragment>
                    <SliderRow
                      label="Speed"
                      value={fx.plotSpeed}
                      min={0.4}
                      max={2.4}
                      step={0.1}
                      onChange={(v) => setFx({ plotSpeed: v })}
                      format={(v) => `× ${v.toFixed(1)}`}
                    />
                    <ToggleRow label="Show rails" value={fx.plotRails} onChange={(v) => setFx({ plotRails: v })} />
                  </Fragment>
                )}
              </Fragment>
            );
          })}
          <div
            style={{
              padding: '8px 10px',
              background: 'var(--paper-2)',
              borderTop: '1px solid var(--line-strong)',
              fontSize: 9,
              color: 'var(--ink-2)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1.5,
            }}
          >
            Caliper: hover anything. Click to pin · ESC to clear.
          </div>
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line-strong)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--ink)' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-deep)' }}
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '7px 10px',
        borderTop: '1px solid var(--line-strong)',
        border: 0,
        background: 'var(--paper)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-1)',
      }}
    >
      <span>{label}</span>
      <span
        style={{
          padding: '2px 6px',
          background: value ? 'var(--ink)' : 'var(--paper-2)',
          color: value ? 'var(--paper)' : 'var(--ink-2)',
          fontSize: 9,
        }}
      >
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
