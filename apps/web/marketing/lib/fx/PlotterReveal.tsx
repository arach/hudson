'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFx } from './FxContext';

export type PlotterRevealProps = {
  children: ReactNode;
  delay?: number;
  label?: string;
  enabled?: boolean;
  onDone?: () => void;
};

export function PlotterReveal({
  children,
  delay = 0,
  label = '',
  enabled = true,
  onDone,
}: PlotterRevealProps) {
  const { fx } = useFx();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [intersected, setIntersected] = useState(false);
  const [run, setRun] = useState(false);
  const [done, setDone] = useState(false);
  const [t, setT] = useState(0);
  const onDoneRef = useRef(onDone);
  // eslint-disable-next-line react-hooks/refs -- latest-callback ref updated during render so the reveal-complete effect calls the current onDone without re-running when its identity changes
  onDoneRef.current = onDone;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!fx.plotter) {
      setDone(true);
      setRun(false);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.25) {
          setIntersected(true);
          obs.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.6] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fx.plotter]);

  useEffect(() => {
    if (!fx.plotter || !intersected || !enabled || run) return;
    const id = setTimeout(() => setRun(true), delay);
    return () => clearTimeout(id);
  }, [fx.plotter, intersected, enabled, delay, run]);

  useEffect(() => {
    if (!run || !fx.plotter) return;
    const dur = 2400 / Math.max(0.2, fx.plotSpeed);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / dur);
      setT(x);
      if (x < 1) raf = requestAnimationFrame(step);
      else {
        setDone(true);
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, fx.plotter, fx.plotSpeed]);

  const W = size.w;
  const H = size.h;
  const peri = 2 * (W + H);
  const traveled = t * peri;
  let pen = { x: 0, y: 0 };
  if (W > 0 && H > 0) {
    const q = traveled;
    if (q <= W) pen = { x: q, y: 0 };
    else if (q <= W + H) pen = { x: W, y: q - W };
    else if (q <= 2 * W + H) pen = { x: W - (q - W - H), y: H };
    else pen = { x: 0, y: H - (q - 2 * W - H) };
  }

  const drawnD = useMemo(() => {
    if (!W || !H) return '';
    const segs: Array<[[number, number], [number, number]]> = [
      [[0, 0], [W, 0]],
      [[W, 0], [W, H]],
      [[W, H], [0, H]],
      [[0, H], [0, 0]],
    ];
    const lens = [W, H, W, H];
    let acc = 0;
    let d = 'M0 0 ';
    let cur = 0;
    for (let i = 0; i < segs.length && cur < traveled; i++) {
      const segLen = lens[i];
      if (traveled >= acc + segLen) {
        d += `L${segs[i][1][0]} ${segs[i][1][1]} `;
        acc += segLen;
        cur = acc;
      } else {
        const frac = (traveled - acc) / segLen;
        const ex = segs[i][0][0] + (segs[i][1][0] - segs[i][0][0]) * frac;
        const ey = segs[i][0][1] + (segs[i][1][1] - segs[i][0][1]) * frac;
        d += `L${ex} ${ey} `;
        cur = traveled + 1;
      }
    }
    return d.trim();
  }, [W, H, traveled]);

  const showRails = fx.plotter && fx.plotRails && run && !done;
  const showGantry = fx.plotter && run && !done;
  const accent = 'var(--accent-deep)';
  const ink = 'var(--ink)';
  const childOpacity = !fx.plotter ? 1 : run ? Math.max(0.45, t) : 0.45;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ opacity: childOpacity, transition: 'opacity 0.4s ease', position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {fx.plotter && run && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <path d={drawnD} fill="none" stroke={ink} strokeWidth="1.25" strokeLinecap="round" />
            <rect x="0" y="0" width={W} height={H} fill="none" stroke={accent} strokeWidth="0.6" strokeDasharray="2 5" opacity="0.4" />
            {showGantry && (
              <g>
                {showRails && (
                  <Fragment>
                    <line x1={-200} y1={pen.y} x2={W + 200} y2={pen.y} stroke={accent} strokeWidth="0.7" strokeDasharray="3 3" opacity="0.5" />
                    <line x1={pen.x} y1={-80} x2={pen.x} y2={H + 80} stroke={accent} strokeWidth="0.7" strokeDasharray="3 3" opacity="0.5" />
                  </Fragment>
                )}
                <g transform={`translate(${pen.x} ${pen.y})`}>
                  <rect x="-8" y="-8" width="16" height="16" fill="var(--paper)" stroke={ink} strokeWidth="1" />
                  <line x1="-6" y1="0" x2="6" y2="0" stroke={accent} strokeWidth="0.8" />
                  <line x1="0" y1="-6" x2="0" y2="6" stroke={accent} strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="1.6" fill={accent} />
                </g>
                <g transform={`translate(${pen.x}, -16)`}>
                  <rect x="-22" y="-8" width="44" height="14" fill={ink} />
                  <text x="0" y="2" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2" fill="var(--paper)">
                    X {String(Math.round(pen.x)).padStart(3, '0')}
                  </text>
                </g>
                <g transform={`translate(-26, ${pen.y})`}>
                  <rect x="-22" y="-7" width="44" height="14" fill={ink} />
                  <text x="0" y="3" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2" fill="var(--paper)">
                    Y {String(Math.round(pen.y)).padStart(3, '0')}
                  </text>
                </g>
              </g>
            )}
            {label && (
              <text x="2" y="-6" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2.5" fill={accent}>
                ⌗ {label} · PLOT {Math.round(t * 100)}%
              </text>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
