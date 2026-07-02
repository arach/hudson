'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { PlotterAccent } from './PlotterCanvas';

const LIVE_REPLOT_DELAY_MS = 320;

export type PlotterControlsProps = {
  draftPhrase: string;
  setDraftPhrase: (v: string) => void;
  commit: (v: string) => void;
  cap: number;
  speed: number;
  setSpeed: (v: number) => void;
  weight: number;
  setWeight: (v: number) => void;
  jitter: number;
  setJitter: (v: number) => void;
  accent: PlotterAccent;
  setAccent: (v: PlotterAccent) => void;
  paperTone: string;
  setPaperTone: (v: string) => void;
  replot: () => void;
  downloadSVG: () => void;
  done: boolean;
  presets: string[];
};

export function PlotterControls({
  draftPhrase,
  setDraftPhrase,
  commit,
  cap,
  speed,
  setSpeed,
  weight,
  setWeight,
  jitter,
  setJitter,
  accent,
  setAccent,
  paperTone,
  setPaperTone,
  replot,
  downloadSVG,
  done,
  presets,
}: PlotterControlsProps) {
  // Debounced live replot — type a character, deck commits to the canvas after
  // ~320ms idle. Replaces the old "click REPLOT or hit ⏎" friction. Enter and
  // blur still flush immediately for keyboard users.
  const liveReplotRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushLive = (v: string) => {
    if (liveReplotRef.current) clearTimeout(liveReplotRef.current);
    liveReplotRef.current = null;
    commit(v);
  };
  const scheduleLive = (v: string) => {
    if (liveReplotRef.current) clearTimeout(liveReplotRef.current);
    liveReplotRef.current = setTimeout(() => commit(v), LIVE_REPLOT_DELAY_MS);
  };
  useEffect(() => () => {
    if (liveReplotRef.current) clearTimeout(liveReplotRef.current);
  }, []);

  return (
    <aside
      style={{
        border: '1.5px solid var(--ink)',
        background: 'var(--paper)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        position: 'sticky',
        // Clear the sticky sheet header (--sheet-header-h ≈ 96px) so the deck
        // doesn't slide underneath when the user scrolls within the plotter.
        top: 'calc(var(--sheet-header-h, 96px) + 16px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: '1px solid var(--line-strong)',
          paddingBottom: 10,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
          }}
        >
          Control Deck
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          HUD-CTL · v01
        </span>
      </div>

      <CtlGroup label="Phrase" hint={`max ${cap} chars`}>
        <input
          value={draftPhrase}
          maxLength={cap}
          onChange={(e) => {
            const v = e.target.value;
            setDraftPhrase(v);
            scheduleLive(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') flushLive(e.currentTarget.value);
          }}
          onBlur={(e) => flushLive(e.currentTarget.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid var(--ink)',
            background: 'var(--paper-2)',
            padding: '10px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className="plotter-chip"
              aria-pressed={p === draftPhrase}
              onClick={() => {
                setDraftPhrase(p);
                flushLive(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </CtlGroup>

      <CtlSlider
        label="Pen speed"
        value={speed}
        min={120}
        max={1100}
        step={10}
        onChange={setSpeed}
        format={(v) => `${v} u/s`}
      />

      <CtlSlider
        label="Line weight"
        value={weight}
        min={0.4}
        max={2.0}
        step={0.05}
        onChange={setWeight}
        format={(v) => `${v.toFixed(2)} mm`}
      />

      <CtlSlider
        label="Hand"
        value={jitter}
        min={0}
        max={2.5}
        step={0.05}
        onChange={setJitter}
        format={(v) =>
          v < 0.2 ? 'mechanical' : v < 0.9 ? 'drafted' : v < 1.6 ? 'hand-inked' : 'rough'
        }
      />

      <CtlGroup label="Ink">
        <SegRow
          options={[
            { id: 'ink', label: 'Graphite' },
            { id: 'accent', label: 'Emerald' },
          ]}
          value={accent}
          onChange={(v) => setAccent(v as PlotterAccent)}
        />
      </CtlGroup>

      <CtlGroup label="Paper">
        <SegRow
          options={[
            { id: 'var(--paper, oklch(0.96 0.005 200))', label: 'Cool' },
            { id: 'oklch(0.93 0.02 80)', label: 'Buff' },
            { id: 'oklch(0.18 0.02 240)', label: 'Cyano' },
          ]}
          value={paperTone}
          onChange={setPaperTone}
        />
      </CtlGroup>

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={replot}>
          ↻ Replot
        </button>
        <button
          type="button"
          className="btn btn--accent"
          style={{ flex: 1 }}
          disabled={!done}
          aria-disabled={!done}
          title={done ? 'Download as SVG' : 'Available when the plot completes'}
          onClick={done ? downloadSVG : undefined}
        >
          {done ? '↓ Save SVG' : '· Drawing…'}
        </button>
      </div>
    </aside>
  );
}

function CtlGroup({ label, hint, children }: { label: string; hint?: string | number; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        {hint !== undefined && <span style={{ fontSize: 9 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function CtlSlider({
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
  format?: (v: number) => string;
}) {
  return (
    <CtlGroup label={label} hint={format ? format(value) : value}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-deep)' }}
      />
    </CtlGroup>
  );
}

function SegRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        border: '1px solid var(--ink)',
      }}
    >
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '8px 6px',
              background: active ? 'var(--ink)' : 'var(--paper)',
              color: active ? 'var(--paper)' : 'var(--ink-1)',
              border: 0,
              borderRight: i < options.length - 1 ? '1px solid var(--ink)' : 0,
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
