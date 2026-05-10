'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useFx } from './FxContext';

const R = 110;
const BEZEL_W = 6;
const PAD = 4;
const TOTAL = R + BEZEL_W + PAD;

export function LensMagnifier() {
  const { fx } = useFx();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const zoomTextRef = useRef<SVGTextElement>(null);

  const snapshot = useCallback(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
    Array.from(document.body.children).forEach((child) => {
      if (child === wrapperRef.current) return;
      if (child.hasAttribute && child.hasAttribute('data-fx-overlay')) return;
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
      const clone = child.cloneNode(true) as Element;
      clone.querySelectorAll?.('input,button,a,video,canvas').forEach((n) => {
        try {
          n.setAttribute('tabindex', '-1');
        } catch {
          /* noop */
        }
      });
      // Replace iframes with sized placeholders — they don't render in clones
      // and are layout-heavy.
      clone.querySelectorAll?.('iframe').forEach((n) => {
        const placeholder = document.createElement('div');
        const r = (n as HTMLIFrameElement).getBoundingClientRect();
        placeholder.style.cssText = `width:${r.width}px;height:${r.height}px;background:var(--paper-3,#ddd);`;
        n.replaceWith(placeholder);
      });
      mirror.appendChild(clone);
    });
    mirror.style.width = document.documentElement.scrollWidth + 'px';
    mirror.style.height = document.documentElement.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    if (!fx.lens) return;
    snapshot();
    const onResize = () => snapshot();
    window.addEventListener('resize', onResize);
    // Iframes swallow pointermove (their content has its own document), which
    // makes the lens lose tracking the moment you cross into an embed. Disable
    // pointer-events on iframes while the lens is active so the cursor falls
    // through to the parent document.
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-fx-lens', '');
    styleEl.textContent = 'iframe { pointer-events: none !important; }';
    document.head.appendChild(styleEl);
    return () => {
      window.removeEventListener('resize', onResize);
      styleEl.remove();
    };
  }, [fx.lens, snapshot]);

  // Single ref-driven loop — no React re-renders on pointer move.
  useEffect(() => {
    if (!fx.lens) return;
    let raf = 0;
    let cur = { x: -9999, y: -9999, present: false };
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.opacity = '0';
    const update = () => {
      raf = 0;
      const w = wrapperRef.current;
      const m = mirrorRef.current;
      if (!w || !m) return;
      // Move the lens chrome to the cursor (single GPU translate).
      w.style.transform = `translate3d(${cur.x - TOTAL}px, ${cur.y - TOTAL}px, 0)`;
      w.style.opacity = cur.present ? '1' : '0';
      // Position the mirror so the document point under the cursor lands at
      // the lens center. Mirror lives inside a 2R×2R overflow:hidden parent,
      // so the GPU layer stays small even though the cloned doc is huge.
      const sx = window.scrollX || 0;
      const sy = window.scrollY || 0;
      const Z = fx.lensZoom;
      const tx = R - (sx + cur.x) * Z;
      const ty = R - (sy + cur.y) * Z;
      m.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${Z})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onMove = (e: PointerEvent) => {
      cur = { x: e.clientX, y: e.clientY, present: true };
      schedule();
    };
    const onLeave = () => {
      cur.present = false;
      schedule();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fx.lens, fx.lensZoom]);

  // Update zoom label text without re-rendering the whole SVG.
  useEffect(() => {
    if (zoomTextRef.current) zoomTextRef.current.textContent = `×${fx.lensZoom.toFixed(1)}`;
  }, [fx.lensZoom]);

  if (!fx.lens) return null;

  // The whole lens (mirror + bezel) is one fixed wrapper that we translate.
  return (
    <div
      ref={wrapperRef}
      data-fx-overlay
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: TOTAL * 2,
        height: TOTAL * 2,
        pointerEvents: 'none',
        zIndex: 95,
        willChange: 'transform, opacity',
        transition: 'opacity 0.18s',
        contain: 'layout paint',
      }}
    >
      {/* Mirror well — small, overflow:hidden, GPU layer stays bounded */}
      <div
        style={{
          position: 'absolute',
          left: PAD + BEZEL_W,
          top: PAD + BEZEL_W,
          width: R * 2,
          height: R * 2,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--paper)',
          contain: 'strict',
        }}
      >
        <div
          ref={mirrorRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        />
      </div>
      <BezelOverlay zoomTextRef={zoomTextRef} initialZoom={fx.lensZoom} />
    </div>
  );
}

function BezelOverlay({
  zoomTextRef,
  initialZoom,
}: {
  zoomTextRef: React.RefObject<SVGTextElement | null>;
  initialZoom: number;
}) {
  const accent = 'var(--accent-deep)';
  const bezelR = R + BEZEL_W / 2;
  const cx = TOTAL;
  const cy = TOTAL;
  const specR = R - 0.5;
  const specStart = polar(cx, cy, specR, -135);
  const specEnd = polar(cx, cy, specR, -55);
  const specPath = `M ${specStart.x.toFixed(2)} ${specStart.y.toFixed(2)} A ${specR} ${specR} 0 0 1 ${specEnd.x.toFixed(2)} ${specEnd.y.toFixed(2)}`;
  return (
    <svg
      width={TOTAL * 2}
      height={TOTAL * 2}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id="lensBezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.005 240)" />
          <stop offset="40%" stopColor="oklch(0.45 0.005 240)" />
          <stop offset="100%" stopColor="oklch(0.16 0.005 240)" />
        </linearGradient>
      </defs>

      <circle cx={cx + 2} cy={cy + 3} r={R + BEZEL_W + 1} fill="oklch(0.16 0.005 240 / 0.18)" />
      <circle cx={cx} cy={cy} r={bezelR} fill="none" stroke="url(#lensBezel)" strokeWidth={BEZEL_W} />
      <circle cx={cx} cy={cy} r={R + BEZEL_W} fill="none" stroke="var(--ink)" strokeWidth={0.75} opacity="0.7" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--ink)" strokeWidth={0.5} opacity="0.5" />
      <path d={specPath} fill="none" stroke="oklch(0.96 0.005 240 / 0.55)" strokeWidth={1.2} strokeLinecap="round" />

      <line x1={cx - 14} y1={cy} x2={cx + 14} y2={cy} stroke={accent} strokeWidth={0.6} opacity="0.55" />
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} stroke={accent} strokeWidth={0.6} opacity="0.55" />
      <circle cx={cx} cy={cy} r={1.4} fill={accent} />

      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const inner = R + 1;
        const outer = R + BEZEL_W - 1;
        const len = i % 3 === 0 ? outer - inner : (outer - inner) * 0.55;
        const r1 = inner;
        const r2 = inner + len;
        const x1 = cx + Math.cos(a) * r1;
        const y1 = cy + Math.sin(a) * r1;
        const x2 = cx + Math.cos(a) * r2;
        const y2 = cy + Math.sin(a) * r2;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.18 0.005 240 / 0.55)" strokeWidth="0.5" />;
      })}

      <text
        ref={zoomTextRef}
        x={cx}
        y={cy + R + BEZEL_W + 12}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="2"
        fill="var(--ink-2)"
      >
        ×{initialZoom.toFixed(1)}
      </text>
    </svg>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}
