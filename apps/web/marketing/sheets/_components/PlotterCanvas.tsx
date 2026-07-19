'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { PLOTTER_FONT, strokeLengthOfPolyline, type GlyphPoint } from '@/marketing/lib/plotter-font';

const W = 1100;
const H = 620;
const PAD = 40;
const GLYPH_BOX_H = 140;
const LETTER_GAP = 18;

export type PlotterAccent = 'ink' | 'accent';

export type PlotterCanvasProps = {
  phrase: string;
  speed: number;
  weight: number;
  jitter: number;
  scale: number;
  paperTone: string;
  accent: PlotterAccent;
  runId: number;
  onProgress?: (t: number) => void;
  onDone?: () => void;
  plotterRef?: RefObject<SVGSVGElement | null>;
};

type LaidOutGlyph = { ch: string; glyph: typeof PLOTTER_FONT[string]; x: number };
type LaidOutLine = { glyphs: LaidOutGlyph[]; width: number };
type Layout = { lines: LaidOutLine[]; totalWidth: number; totalHeight: number; scale: number };

type Stroke = { d: string; length: number; kind: 'glyph' };

type Bbox = { x: number; y: number; w: number; h: number };

type Dim =
  | { kind: 'dim-line' | 'dim-tick' | 'dim-leader'; d: string }
  | { kind: 'dim-label'; x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; rotate?: number }
  | { kind: 'leader'; d: string }
  | { kind: 'leader-label'; x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' };

function layoutPhrase(text: string, scale: number): Layout {
  const upper = text.toUpperCase();
  const lines = upper.split('\n');
  const laidOut: LaidOutLine[] = [];

  for (const line of lines) {
    let cursor = 0;
    const lineGlyphs: LaidOutGlyph[] = [];
    for (const ch of line) {
      const glyph = PLOTTER_FONT[ch] ?? PLOTTER_FONT[' '];
      lineGlyphs.push({ ch, glyph, x: cursor });
      cursor += glyph.advance + LETTER_GAP;
    }
    laidOut.push({ glyphs: lineGlyphs, width: Math.max(0, cursor - LETTER_GAP) });
  }

  const totalWidth = Math.max(...laidOut.map((l) => l.width));
  const lineHeight = (GLYPH_BOX_H + 30) * scale;
  const totalHeight = laidOut.length * lineHeight;
  return { lines: laidOut, totalWidth: totalWidth * scale, totalHeight, scale };
}

function wobblePoint(x: number, y: number, jitter: number, seed: number): GlyphPoint {
  if (jitter <= 0) return [x, y];
  const a = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const b = Math.sin(seed * 39.346 + 11.135) * 24634.6345;
  const fx = (a - Math.floor(a)) - 0.5;
  const fy = (b - Math.floor(b)) - 0.5;
  return [x + fx * jitter, y + fy * jitter];
}

function polylineToD(pts: GlyphPoint[], jitter = 0, seedBase = 0): string {
  if (pts.length === 0) return '';
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = jitter > 0 ? wobblePoint(pts[i][0], pts[i][1], jitter, seedBase + i) : pts[i];
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
  }
  return d.trim();
}

function buildPlot(text: string, opts: { scale: number; jitter: number }): { strokes: Stroke[]; bbox: Bbox } {
  const { scale, jitter } = opts;
  const layout = layoutPhrase(text, scale);

  const drawingW = layout.totalWidth;
  const drawingH = layout.totalHeight;
  const areaCenterX = W / 2;
  const areaCenterY = H * 0.46;
  const startX = areaCenterX - drawingW / 2;
  const startY = areaCenterY - drawingH / 2;

  const strokes: Stroke[] = [];
  let strokeIdx = 0;

  for (let li = 0; li < layout.lines.length; li++) {
    const line = layout.lines[li];
    const lineY = startY + li * (GLYPH_BOX_H + 30) * scale;

    for (const { glyph, x } of line.glyphs) {
      for (const poly of glyph.strokes) {
        const transformed: GlyphPoint[] = poly.map(([px, py]) => [
          startX + (x + px) * scale,
          lineY + py * scale,
        ]);
        const len = strokeLengthOfPolyline(transformed);
        strokes.push({
          d: polylineToD(transformed, jitter, strokeIdx * 7.7),
          length: len,
          kind: 'glyph',
        });
        strokeIdx++;
      }
    }
  }

  return {
    strokes,
    bbox: { x: startX, y: startY, w: drawingW, h: drawingH },
  };
}

function buildDimensions(bbox: Bbox): Dim[] {
  const dims: Dim[] = [];
  const offset = 28;
  const tick = 6;

  const yTop = bbox.y - offset;
  dims.push({ kind: 'dim-line', d: `M${bbox.x} ${yTop} L${bbox.x + bbox.w} ${yTop}` });
  dims.push({
    kind: 'dim-tick',
    d: `M${bbox.x} ${yTop - tick} L${bbox.x} ${yTop + tick}
        M${bbox.x + bbox.w} ${yTop - tick} L${bbox.x + bbox.w} ${yTop + tick}`,
  });
  dims.push({
    kind: 'dim-leader',
    d: `M${bbox.x} ${bbox.y} L${bbox.x} ${yTop - tick}
        M${bbox.x + bbox.w} ${bbox.y} L${bbox.x + bbox.w} ${yTop - tick}`,
  });
  dims.push({
    kind: 'dim-label',
    x: bbox.x + bbox.w / 2,
    y: yTop - 8,
    text: `${Math.round(bbox.w)} mm`,
    anchor: 'middle',
  });

  const xLeft = bbox.x - offset;
  dims.push({ kind: 'dim-line', d: `M${xLeft} ${bbox.y} L${xLeft} ${bbox.y + bbox.h}` });
  dims.push({
    kind: 'dim-tick',
    d: `M${xLeft - tick} ${bbox.y} L${xLeft + tick} ${bbox.y}
        M${xLeft - tick} ${bbox.y + bbox.h} L${xLeft + tick} ${bbox.y + bbox.h}`,
  });
  dims.push({
    kind: 'dim-leader',
    d: `M${bbox.x} ${bbox.y} L${xLeft - tick} ${bbox.y}
        M${bbox.x} ${bbox.y + bbox.h} L${xLeft - tick} ${bbox.y + bbox.h}`,
  });
  dims.push({
    kind: 'dim-label',
    x: xLeft - 8,
    y: bbox.y + bbox.h / 2,
    text: `${Math.round(bbox.h)} mm`,
    anchor: 'end',
    rotate: -90,
  });

  const cx = bbox.x + bbox.w * 0.18;
  const cy = bbox.y + bbox.h * 0.5;
  const lx = bbox.x + bbox.w + 70;
  // Drop the leader well below the text bottom so the horizontal callout sits
  // cleanly in the open margin between the drafted phrase and the title block.
  // Long diagonal (kink at cx + 64) keeps the slope reading as a draftsman's
  // dimension rather than a stub off the glyph.
  const ly = bbox.y + bbox.h + 56;
  dims.push({
    kind: 'leader',
    d: `M${cx} ${cy} L${cx + 64} ${ly} L${lx} ${ly}`,
  });
  dims.push({
    kind: 'leader-label',
    x: lx,
    y: ly - 6,
    text: 'STROKE: 0.30 mm · ISO 3098',
    anchor: 'end',
  });

  return dims;
}

export function PlotterCanvas({
  phrase,
  speed,
  weight,
  jitter,
  scale,
  paperTone,
  accent,
  runId,
  onProgress,
  onDone,
  plotterRef,
}: PlotterCanvasProps) {
  const { strokes, bbox } = useMemo(
    () => buildPlot(phrase || ' ', { scale, jitter }),
    [phrase, scale, jitter],
  );
  const dims = useMemo(() => buildDimensions(bbox), [bbox]);
  const totalLen = useMemo(() => strokes.reduce((a, s) => a + s.length, 0), [strokes]);

  const [traveled, setTraveled] = useState(0);
  const [phase, setPhase] = useState<'drawing' | 'dimensions' | 'done'>('drawing');
  const rafRef = useRef(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    setTraveled(0);
    setPhase('drawing');
    startedAtRef.current = performance.now();

    const drawDuration = Math.max(1500, totalLen / Math.max(60, speed));
    const dimsDuration = 1200;

    const step = (now: number) => {
      const elapsed = now - startedAtRef.current;
      if (elapsed < drawDuration) {
        const t = elapsed / drawDuration;
        const eased = t < 0.92 ? t / 0.92 : 0.999;
        setTraveled(eased * totalLen);
        onProgress?.(eased);
        rafRef.current = requestAnimationFrame(step);
      } else if (elapsed < drawDuration + dimsDuration) {
        setTraveled(totalLen);
        setPhase((p) => (p === 'dimensions' ? p : 'dimensions'));
        rafRef.current = requestAnimationFrame(step);
      } else {
        setTraveled(totalLen);
        setPhase('done');
        onProgress?.(1);
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, totalLen, speed]);

  const penTip = useMemo<GlyphPoint | null>(() => {
    let acc = 0;
    for (const s of strokes) {
      if (acc + s.length >= traveled) {
        const need = traveled - acc;
        const tokens = s.d.replace(/M|L/g, ' ').trim().split(/\s+/).map(Number);
        const pts: GlyphPoint[] = [];
        for (let i = 0; i < tokens.length; i += 2) pts.push([tokens[i], tokens[i + 1]]);
        let walked = 0;
        for (let i = 1; i < pts.length; i++) {
          const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (walked + segLen >= need) {
            const t = segLen === 0 ? 0 : (need - walked) / segLen;
            return [
              pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
              pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
            ];
          }
          walked += segLen;
        }
        return pts[pts.length - 1] ?? null;
      }
      acc += s.length;
    }
    return null;
  }, [strokes, traveled]);

  const strokeStates = useMemo(() => {
    let acc = 0;
    return strokes.map((s) => {
      const start = acc;
      acc += s.length;
      const reveal = Math.max(0, Math.min(s.length, traveled - start));
      return { ...s, reveal };
    });
  }, [strokes, traveled]);

  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (plotterRef) plotterRef.current = svgRef.current;
  }, [plotterRef]);

  const dimsOpacity = phase === 'drawing' ? 0 : 1;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: 'auto', background: paperTone }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="hpMinor" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0V14" fill="none" stroke="oklch(0.86 0.01 240 / 0.32)" strokeWidth="0.5" />
        </pattern>
        <pattern id="hpMajor" width="84" height="84" patternUnits="userSpaceOnUse">
          <path d="M84 0H0V84" fill="none" stroke="oklch(0.78 0.012 240 / 0.46)" strokeWidth="0.65" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--ink, #1c1f24)" />
        </marker>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="url(#hpMinor)" />
      <rect x="0" y="0" width={W} height={H} fill="url(#hpMajor)" />

      <rect
        x={PAD / 2}
        y={PAD / 2}
        width={W - PAD}
        height={H - PAD}
        fill="none"
        stroke="var(--ink, #1c1f24)"
        strokeWidth="1"
      />

      <g>
        {Array.from({ length: Math.floor((W - PAD) / 14) + 1 }, (_, i) => (
          <line
            key={i}
            x1={PAD / 2 + i * 14}
            y1={PAD / 2}
            x2={PAD / 2 + i * 14}
            y2={PAD / 2 + (i % 6 === 0 ? 8 : 4)}
            stroke="var(--ink, #1c1f24)"
            strokeWidth="0.7"
          />
        ))}
      </g>

      <g fontFamily="var(--font-mono, JetBrains Mono, monospace)" fontSize="10" fill="var(--ink, #1c1f24)">
        <text x={PAD} y={H - PAD + 6} letterSpacing="2.5">
          HUDSONKIT · DRAFTING PLOTTER · HP-7475A EMU
        </text>
        <text x={W - PAD} y={H - PAD + 6} letterSpacing="2.5" textAnchor="end">
          {`SCALE 1:1   PEN ${weight.toFixed(2)}MM   N=${strokes.length}`}
        </text>
      </g>

      <g
        stroke={accent === 'accent' ? 'var(--accent-deep, oklch(0.50 0.16 162))' : 'var(--ink, #1c1f24)'}
        strokeWidth={weight * 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {strokeStates.map((s, i) => (
          <path
            key={i}
            d={s.d}
            strokeDasharray={`${s.length} ${s.length}`}
            strokeDashoffset={s.length - s.reveal}
          />
        ))}
      </g>

      <g opacity={dimsOpacity} style={{ transition: 'opacity 0.6s ease' }}>
        {dims.map((d, i) => {
          if (d.kind === 'dim-line' || d.kind === 'dim-tick' || d.kind === 'dim-leader') {
            return (
              <path
                key={i}
                d={d.d}
                stroke="var(--accent-deep, oklch(0.50 0.16 162))"
                strokeWidth="0.65"
                fill="none"
              />
            );
          }
          if (d.kind === 'dim-label') {
            return (
              <text
                key={i}
                x={d.x}
                y={d.y}
                fontFamily="var(--font-mono, JetBrains Mono, monospace)"
                fontSize="10"
                fill="var(--accent-deep, oklch(0.50 0.16 162))"
                textAnchor={d.anchor ?? 'start'}
                transform={d.rotate ? `rotate(${d.rotate} ${d.x} ${d.y})` : undefined}
                letterSpacing="2"
              >
                {d.text}
              </text>
            );
          }
          if (d.kind === 'leader') {
            return (
              <path
                key={i}
                d={d.d}
                stroke="var(--ink, #1c1f24)"
                strokeWidth="0.65"
                fill="none"
                markerStart="url(#arrow)"
              />
            );
          }
          if (d.kind === 'leader-label') {
            return (
              <text
                key={i}
                x={d.x}
                y={d.y}
                fontFamily="var(--font-mono, JetBrains Mono, monospace)"
                fontSize="10"
                fill="var(--ink, #1c1f24)"
                textAnchor={d.anchor ?? 'start'}
                letterSpacing="2"
              >
                {d.text}
              </text>
            );
          }
          return null;
        })}
      </g>

      <g transform={`translate(${W - PAD - 230} ${H - PAD - 86})`}>
        <rect
          x="0"
          y="0"
          width="230"
          height="60"
          fill="var(--paper, #f3f3ee)"
          stroke="var(--ink, #1c1f24)"
          strokeWidth="0.9"
        />
        <line x1="0" y1="20" x2="230" y2="20" stroke="var(--ink, #1c1f24)" strokeWidth="0.6" />
        <line x1="115" y1="20" x2="115" y2="60" stroke="var(--ink, #1c1f24)" strokeWidth="0.6" />
        <text x="6" y="14" fontFamily="var(--font-mono, monospace)" fontSize="9" letterSpacing="2.5">
          PLOT · PHRASE SPECIMEN
        </text>
        <text
          x="6"
          y="35"
          fontFamily="var(--font-mono, monospace)"
          fontSize="8"
          fill="var(--ink-2, #5a6068)"
          letterSpacing="2"
        >
          DRAWN
        </text>
        <text x="6" y="50" fontFamily="var(--font-mono, monospace)" fontSize="11" fontWeight="700" letterSpacing="1.5">
          HUDSON
        </text>
        <text
          x="121"
          y="35"
          fontFamily="var(--font-mono, monospace)"
          fontSize="8"
          fill="var(--ink-2, #5a6068)"
          letterSpacing="2"
        >
          SHEET
        </text>
        <text
          x="121"
          y="50"
          fontFamily="var(--font-mono, monospace)"
          fontSize="11"
          fontWeight="700"
          letterSpacing="1.5"
        >
          {`P-${String(runId).padStart(3, '0')} / 01`}
        </text>
      </g>

      {penTip && phase === 'drawing' && (
        <g transform={`translate(${penTip[0]} ${penTip[1]})`}>
          <path
            d="M0 0 L18 -28 L26 -22 L8 6 Z"
            fill="var(--ink, #1c1f24)"
            stroke="var(--ink, #1c1f24)"
            strokeWidth="0.8"
          />
          <path
            d="M0 0 L4 -3 L8 -6"
            fill="none"
            stroke="var(--accent, oklch(0.62 0.16 162))"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="2.2" fill="var(--accent, oklch(0.62 0.16 162))" />
          <circle cx="0" cy="0" r="6" fill="none" stroke="var(--accent, oklch(0.62 0.16 162))" strokeWidth="0.6" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

export const PLOTTER_W = W;
export const PLOTTER_H = H;
export const PLOTTER_PAD = PAD;
export const PLOTTER_GLYPH_BOX_H = GLYPH_BOX_H;
export const PLOTTER_LETTER_GAP = LETTER_GAP;
