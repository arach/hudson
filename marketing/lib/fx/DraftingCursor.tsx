'use client';

import { useFx } from './FxContext';
import { usePointer } from './usePointer';

export function DraftingCursor() {
  const { fx } = useFx();
  const p = usePointer();
  if (!fx.cursor) return null;
  const gx = Math.round(p.x / 12) * 12;
  const gy = Math.round(p.y / 12) * 12;
  const visible = p.present;
  const accent = 'var(--accent-deep)';
  const winW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 0;
  return (
    <div
      data-fx-overlay
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 90,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: gy, height: 1, background: accent, opacity: 0.4 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: gx, width: 1, background: accent, opacity: 0.4 }} />
      <svg width="36" height="36" style={{ position: 'absolute', left: gx - 18, top: gy - 18 }}>
        <circle cx="18" cy="18" r="9" fill="none" stroke={accent} strokeWidth="1" />
        <circle cx="18" cy="18" r="1.5" fill={accent} />
        <line x1="18" y1="0" x2="18" y2="6" stroke={accent} strokeWidth="1" />
        <line x1="18" y1="30" x2="18" y2="36" stroke={accent} strokeWidth="1" />
        <line x1="0" y1="18" x2="6" y2="18" stroke={accent} strokeWidth="1" />
        <line x1="30" y1="18" x2="36" y2="18" stroke={accent} strokeWidth="1" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: Math.min(winW - 110, gx + 22),
          top: Math.min(winH - 24, gy + 16),
          padding: '3px 7px',
          background: 'var(--ink)',
          color: 'var(--paper)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        X {String(gx).padStart(4, '0')} · Y {String(gy).padStart(4, '0')}
      </div>
    </div>
  );
}
