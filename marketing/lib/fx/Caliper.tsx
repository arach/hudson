'use client';

import { useEffect, useState } from 'react';
import { useFx } from './FxContext';

type CaliperRect = { x: number; y: number; w: number; h: number };
type Layer = { rect: CaliperRect; label: string; key: string; tone: 'pinned' | 'hover' };
type Measured = { rect: CaliperRect; label: string };

function measure(el: Element): Measured {
  const r = el.getBoundingClientRect();
  const label =
    el.getAttribute('data-cal-label') ||
    el.getAttribute('data-screen-label') ||
    el.tagName.toLowerCase() +
      (el.className ? '.' + ('' + (el as HTMLElement).className).split(' ')[0] : '');
  return { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, label };
}

export function Caliper() {
  const { fx } = useFx();
  const [hover, setHover] = useState<Measured | null>(null);
  const [pinned, setPinned] = useState<Measured | null>(null);

  useEffect(() => {
    if (!fx.caliper) {
      setHover(null);
      setPinned(null);
      return;
    }
    let cur: Element | null = null;
    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest('[data-cal]') ?? null;
      if (!el || el === cur) return;
      cur = el;
      setHover(measure(el));
    };
    const onOut = () => {
      cur = null;
      setHover(null);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest('[data-cal]') ?? null;
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        setPinned(measure(el));
      }
    };
    const onScroll = () => {
      if (cur) setHover(measure(cur));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(null);
        setHover(null);
      }
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerleave', onOut);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerleave', onOut);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [fx.caliper]);

  if (!fx.caliper) return null;
  const layers: Layer[] = [];
  if (pinned) layers.push({ ...pinned, key: 'pin', tone: 'pinned' });
  if (hover && (!pinned || hover.label !== pinned.label)) {
    layers.push({ ...hover, key: 'hov', tone: 'hover' });
  }

  return (
    <div data-fx-overlay aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 92 }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {layers.map((L) => (
          <CaliperLayer key={L.key} layer={L} />
        ))}
      </svg>
      {layers.map((L) => (
        <CaliperBadge key={L.key + 'b'} layer={L} />
      ))}
    </div>
  );
}

function CaliperLayer({ layer }: { layer: Layer }) {
  const { rect, tone } = layer;
  const accent = tone === 'pinned' ? 'var(--accent-deep)' : 'var(--ink-2)';
  const dash = tone === 'pinned' ? '0' : '3 3';
  const off = 14;
  const tick = 7;
  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="none" stroke={accent} strokeWidth="1" strokeDasharray={dash} />
      <line x1={rect.x} y1={rect.y - off} x2={rect.x + rect.w} y2={rect.y - off} stroke={accent} strokeWidth="1" />
      <line x1={rect.x} y1={rect.y - off - tick} x2={rect.x} y2={rect.y - off + tick} stroke={accent} strokeWidth="1" />
      <line x1={rect.x + rect.w} y1={rect.y - off - tick} x2={rect.x + rect.w} y2={rect.y - off + tick} stroke={accent} strokeWidth="1" />
      <line x1={rect.x - off} y1={rect.y} x2={rect.x - off} y2={rect.y + rect.h} stroke={accent} strokeWidth="1" />
      <line x1={rect.x - off - tick} y1={rect.y} x2={rect.x - off + tick} y2={rect.y} stroke={accent} strokeWidth="1" />
      <line x1={rect.x - off - tick} y1={rect.y + rect.h} x2={rect.x - off + tick} y2={rect.y + rect.h} stroke={accent} strokeWidth="1" />
      <circle cx={rect.x + rect.w} cy={rect.y + rect.h} r="1.6" fill={accent} />
      <path
        d={`M${rect.x + rect.w} ${rect.y + rect.h} L${rect.x + rect.w + 14} ${rect.y + rect.h + 10} L${rect.x + rect.w + 28} ${rect.y + rect.h + 10}`}
        fill="none"
        stroke={accent}
        strokeWidth="0.8"
        strokeDasharray={tone === 'pinned' ? '0' : '2 3'}
        opacity="0.85"
      />
      <text
        x={rect.x + rect.w / 2}
        y={rect.y - off - 5}
        fill={accent}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="2"
      >
        {Math.round(rect.w)} px
      </text>
      <text
        x={rect.x - off - 5}
        y={rect.y + rect.h / 2}
        fill={accent}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="2"
        transform={`rotate(-90 ${rect.x - off - 5} ${rect.y + rect.h / 2})`}
      >
        {Math.round(rect.h)} px
      </text>
    </g>
  );
}

function CaliperBadge({ layer }: { layer: Layer }) {
  const { rect, tone, label } = layer;
  const accent = tone === 'pinned' ? 'var(--accent-deep)' : 'var(--ink-2)';
  const w = rect.w;
  const h = rect.h;
  const diag = Math.hypot(w, h);
  const ar = w / Math.max(1, h);
  const arStr = (() => {
    const guesses: Array<[number, number]> = [
      [16, 9], [4, 3], [3, 2], [1, 1], [3, 4], [9, 16], [2, 1], [5, 4], [21, 9],
    ];
    let best = guesses[0];
    let bd = Infinity;
    for (const [a, b] of guesses) {
      const d = Math.abs(ar - a / b);
      if (d < bd) {
        bd = d;
        best = [a, b];
      }
    }
    if (bd / ar < 0.05) return `${best[0]} : ${best[1]}`;
    return ar.toFixed(3);
  })();
  const winW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 0;
  const bx = Math.min(winW - 220, rect.x + w + 12);
  const by = Math.min(winH - 92, rect.y + h - 4);
  return (
    <div
      data-fx-overlay
      style={{
        position: 'fixed',
        left: bx,
        top: by,
        width: 200,
        background: 'var(--paper)',
        border: `1.5px solid ${accent}`,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          background: accent,
          color: 'var(--paper)',
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700 }}>{tone === 'pinned' ? '◉ PINNED' : '◯ HOVER'}</span>
        <span style={{ opacity: 0.85 }}>{label && label.slice(0, 22)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {([
          ['W', Math.round(w) + ' px'],
          ['H', Math.round(h) + ' px'],
          ['◢', Math.round(diag) + ' px'],
          ['AR', arStr],
          ['X', Math.round(rect.x) + ' px'],
          ['Y', Math.round(rect.y) + ' px'],
        ] as Array<[string, string]>).map(([k, v]) => (
          <div
            key={k}
            style={{
              padding: '4px 8px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>{k}</span>
            <span style={{ color: 'var(--ink)' }}>{v}</span>
          </div>
        ))}
      </div>
      {tone === 'pinned' && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid var(--line)', fontSize: 9, color: 'var(--ink-2)' }}>
          ESC TO CLEAR · CLICK ANOTHER TO RE-PIN
        </div>
      )}
    </div>
  );
}
