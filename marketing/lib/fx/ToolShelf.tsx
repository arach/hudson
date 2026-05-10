'use client';

import type { ReactNode } from 'react';
import { useFx, type FxState } from './FxContext';

type ToolEntry = {
  id: keyof FxState;
  label: string;
  hint: string;
  icon: ReactNode;
};

const TOOLS: ToolEntry[] = [
  {
    id: 'lens',
    label: 'Monocle',
    hint: 'magnify',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <line x1="10.5" y1="10.5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    id: 'caliper',
    label: 'Caliper',
    hint: 'measure · pin',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <line x1="3" y1="2" x2="3" y2="14" stroke="currentColor" strokeWidth="1.3" />
        <line x1="13" y1="2" x2="13" y2="14" stroke="currentColor" strokeWidth="1.3" />
        <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" />
        <line x1="0" y1="2" x2="5" y2="2" stroke="currentColor" strokeWidth="1.3" />
        <line x1="11" y1="2" x2="16" y2="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    id: 'cursor',
    label: 'Crosshair',
    hint: 'X/Y readout',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <line x1="8" y1="0" x2="8" y2="16" stroke="currentColor" strokeWidth="1.3" />
        <line x1="0" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    id: 'plotter',
    label: 'Plotter',
    hint: 'cnc reveals',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <rect x="6" y="6" width="4" height="4" fill="currentColor" />
        <line x1="0" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.4 1.4" />
      </svg>
    ),
  },
];

export function ToolShelf({ note }: { note?: string }) {
  const { fx, setFx } = useFx();
  return (
    <aside
      data-fx-overlay
      style={{
        position: 'sticky',
        top: 96,
        marginLeft: 'auto',
        width: 88,
        alignSelf: 'start',
        border: '1.5px solid var(--ink)',
        background: 'var(--paper)',
        boxShadow: '0 4px 0 var(--paper-edge)',
        fontFamily: 'var(--font-mono)',
        zIndex: 5,
      }}
    >
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--paper)',
          fontSize: 8.5,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          padding: '6px 8px',
          textAlign: 'center',
          borderBottom: '1.5px solid var(--ink)',
        }}
      >
        Toolkit
      </div>
      {TOOLS.map((t, i) => {
        const on = !!fx[t.id];
        return (
          <button
            key={t.id}
            onClick={() => setFx((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
            title={`${t.label} — ${t.hint}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 6px',
              width: '100%',
              border: 0,
              borderTop: i > 0 ? '1px solid var(--line-strong)' : 0,
              background: on ? 'var(--accent-soft)' : 'var(--paper)',
              color: on ? 'var(--accent-deep)' : 'var(--ink-1)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 6,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: on ? 'var(--accent)' : 'var(--ink-faint)',
              }}
            />
            {t.icon}
            <span style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{t.label}</span>
          </button>
        );
      })}
      {note && (
        <div
          style={{
            background: 'var(--paper-2)',
            borderTop: '1.5px solid var(--ink)',
            padding: '6px 7px',
            fontSize: 8,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          {note}
        </div>
      )}
    </aside>
  );
}
